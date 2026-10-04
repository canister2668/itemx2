/* Ledger: the chat's ITEMX document as the runtime sees it. The projection
 * folds the document over the current message order; anchors resolve against
 * that fold; the chat-level operations below are the only writers. */
import * as Backup from './engine/backup.js';
import * as Codex from './engine/codex.js';
import * as Core from './engine/core.js';
import * as Lorebook from './engine/lorebook.js';
import { chatIsStreaming, context, readChat, saveChat } from './chat-io.js';
import { ITEMX_STORAGE_WARNING_BYTES } from './config.js';
import { emit } from './events.js';
import { t } from './i18n.js';
import { timedSync, workQueue } from './kernel.js';
import { encounterRegistryFingerprint, prepareInlinePortraits } from './portraits.js';
import {
  activeContextKey,
  cachedLoaded,
  currentGeneration,
  dropPending,
  freshLoaded,
  invalidateLoaded,
  pendingEntries,
  pendingRecord,
  setLatestKeys,
  storeLoaded,
  updateCachedChat
} from './session.js';
import { changeSettings, settingsFor } from './settings.js';
import { setStatus } from './status.js';
import {
  anchorKeys,
  countOldMarkers,
  hasAnchor,
  stripAnchors,
  stripOldMarkers,
  stripTransport
} from './store/anchors.js';
import { DOCUMENT_KEY, footprint, readDocument, withDocument } from './store/document.js';
import { freeze, thaw } from './store/payload.js';
import { fold, restampEntries, windowOffset } from './store/replay.js';

const messageId = (message) => (typeof message?.chatId === 'string' ? message.chatId : '');
const messageTime = (message) => (Number.isFinite(message?.time) && message.time > 0 ? message.time : 0);

// Everything the fold depends on, hashed without serializing the chat: the
// stored document string and each message's id and anchors.
export function replayFingerprint(chat) {
  const raw = chat?.scriptstate?.[DOCUMENT_KEY];
  let source = typeof raw === 'string' ? raw : raw == null ? '' : JSON.stringify(raw);
  for (const message of chat?.message || []) {
    const text = Core.messageText(message);
    source += `|${messageId(message)}`;
    if (hasAnchor(text)) source += `:${anchorKeys(text).join(',')}`;
  }
  return Core.fnv1a(source);
}

// A read-only projection of `ctx.chat`: the fold of its loaded messages from
// the newest valid state entry.
export function project(ctx, settings = {}) {
  const doc = readDocument(ctx.chat);
  const pending = (key) => (pendingRecord(key)?.chatKey === ctx.key ? pendingRecord(key) : null);
  const folded = timedSync('replay', () => fold(ctx.chat, doc, { pending }));
  const codexBase = folded.codex;
  codexBase.fingerprint = folded.chain;
  const codexSnapshot = Object.keys(doc.lore.rows).length ? Lorebook.apply(codexBase, doc.lore) : codexBase;
  return {
    ...ctx,
    ...settings,
    doc,
    prefs: doc.prefs,
    snapshot: {
      schema: Core.VERSION,
      registry: folded.item.registry,
      history: folded.item.history,
      fingerprint: folded.chain
    },
    codexSnapshot,
    views: folded.views,
    notes: folded.notes,
    turn: folded.turn,
    grounded: folded.grounded,
    lorebookSourceFingerprint: encounterRegistryFingerprint(codexBase),
    replayFingerprint: replayFingerprint(ctx.chat)
  };
}

const asPayload = (row) =>
  row?.view
    ? { event: row.event, view: row.view, previous: row.previous, review: row.review, domain: row.domain }
    : null;

// A committed card frozen at its commit: older cards render without a replay.
const frozenPayload = (row) => {
  const frozen = thaw(row);
  return frozen
    ? {
        event: row.e,
        view: frozen.view,
        previous: frozen.previous,
        review: row.r,
        domain: row.d === 'item' ? 'item' : row.e?.domain
      }
    : null;
};

// The card behind one anchor: the fold's view, the parsed but not yet
// committed record of the current response, or the frozen committed card.
export function anchorPayload(key, loaded = cachedLoaded()) {
  return (
    asPayload(loaded?.views?.get(`e:${key}`)) ||
    asPayload(pendingRecord(key)) ||
    frozenPayload(loaded?.doc?.events?.[key])
  );
}

// Anchors of the newest response, the only cards that may animate and the
// source of the side badge's gain/loss count.
export function refreshLatest(loaded) {
  const messages = loaded?.chat?.message || [];
  let keys = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = Core.messageText(messages[index]);
    if (!hasAnchor(text)) continue;
    keys = anchorKeys(text);
    break;
  }
  for (const [key] of pendingEntries(loaded?.key || activeContextKey())) keys.push(key);
  setLatestKeys(keys);
  void emit('markers');
}

export async function rebuildCurrent(ctx = null) {
  const from = currentGeneration();
  ctx ||= await context();
  if (!ctx) return null;
  const settings = await settingsFor(ctx.character);
  const loaded = project(ctx, settings);
  const warning = footprint(ctx.chat).stateBytes >= ITEMX_STORAGE_WARNING_BYTES;
  setStatus(
    t(
      'ledger.026',
      warning ? (settings.autoPruneEnabled ? t('ledger.029') : t('ledger.029-off')) : t('runtime.003'),
      loaded.snapshot.registry.order.length,
      loaded.codexSnapshot.skills.order.length,
      loaded.codexSnapshot.monsters.order.length
    )
  );
  prepareInlinePortraits(loaded, loaded.codexSnapshot, settings);
  storeLoaded(loaded, from);
  refreshLatest(loaded);
  return loaded;
}

// The cached projection while the chat's replay inputs are unchanged,
// otherwise a fresh one.
export async function cachedOrRebuildCurrent() {
  const active = await context();
  if (!active) return null;
  const cached = freshLoaded();
  if (cached?.key === active.key && cached.replayFingerprint === replayFingerprint(active.chat)) {
    cached.chat = active.chat;
    return cached;
  }
  return rebuildCurrent(active);
}

// The display hook's projection. Anchors the loaded document or the pending
// records know need no host call; an unknown anchor waits for the one load in
// flight (at most once per projection and key, so a stray anchor cannot cause
// a reload per render), bounded so a stalled host never blanks a message.
const DISPLAY_WAIT_MS = 8000;
let displayLoad = null;
const displayMisses = new WeakMap();
const knows = (loaded, key) => Boolean(loaded?.doc?.events?.[key] || pendingRecord(key));
export function displayProjection(keys = []) {
  const loaded = cachedLoaded();
  if (loaded?.key === activeContextKey()) {
    const misses = displayMisses.get(loaded) || new Set();
    const unknown = keys.filter((key) => !knows(loaded, key) && !misses.has(key));
    if (!unknown.length) return loaded;
    for (const key of unknown) misses.add(key);
    displayMisses.set(loaded, misses);
  } else if (keys.length && keys.every((key) => pendingRecord(key))) return loaded;
  displayLoad ||= rebuildCurrent()
    .catch(() => null)
    .finally(() => {
      displayLoad = null;
    });
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = globalThis.setTimeout(() => resolve(cachedLoaded()), DISPLAY_WAIT_MS);
  });
  return Promise.race([displayLoad, timeout]).finally(() => globalThis.clearTimeout(timer));
}

// The latest previous view and review of an entity, for the drawer's change
// and review annotations. They travel inside the state.
export function presentationRecord(domain, id, loaded = cachedLoaded()) {
  return loaded?.notes?.[`${domain}:${id}`] || {};
}

// Registers parsed records as committed events of message `chatId`.
export function commitRecords(doc, records, chatId) {
  for (const record of records) {
    if (doc.events[record.key]) continue;
    doc.seq += 1;
    doc.events[record.key] = {
      c: chatId,
      d: record.domain === 'item' ? 'item' : 'codex',
      e: record.event,
      ...(record.review ? { r: record.review } : {}),
      s: doc.seq,
      t: Date.now()
    };
  }
}

// Recomputes the state entries from local message `index` on (the message a
// write just changed and every later one) and freezes the card payloads the
// recomputation produced. A window that cannot ground the state stamps nothing.
export function stampFrom(doc, chat, index) {
  const views = restampEntries(chat, doc, index);
  if (!views) return false;
  for (const [id, row] of views) {
    const event = id.startsWith('e:') ? doc.events[id.slice(2)] : null;
    if (!event) continue;
    // A card the replay can no longer apply must not keep its old face.
    freeze(event, row.view, row.previous || null);
  }
  return true;
}

// Read-modify-write of the chat's document. `change(doc, latest)` edits `doc`
// in place and may return `{ chat }` with replacement messages, or false to
// write nothing. The write lands only if the chat is still the one read.
const bytesOf = (doc) => new TextEncoder().encode(JSON.stringify(doc)).length;

export async function writeDocument(ctx, change, { idle = true } = {}) {
  workQueue.assertCurrent();
  const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
  if (!latest) throw new Error(t('ledger.006'));
  if (idle && chatIsStreaming(latest)) throw new Error(t('ledger.025'));
  const doc = readDocument(latest);
  const result = await change(doc, latest);
  if (result === false) return null;
  const chat = result?.chat || latest;
  // At the storage limit a write prunes what is provably gone, when it can and
  // the bot has not turned automatic cleanup off.
  if (
    bytesOf(doc) >= ITEMX_STORAGE_WARNING_BYTES &&
    !pruneBlocker(chat) &&
    (!ctx.character || (await settingsFor(ctx.character)).autoPruneEnabled)
  )
    pruneDocument(doc, chat);
  const next = withDocument(chat, doc);
  const written = await saveChat(ctx.characterIndex, ctx.chatIndex, next, latest);
  if (activeContextKey() === ctx.key) invalidateLoaded();
  return { chat: written, doc };
}

export async function commitManualEvents(loaded, events, label, review = { source: 'manual' }, refresh = true) {
  if (!loaded || !Array.isArray(events) || !events.length) throw new Error('No manual events to commit');
  await writeDocument(loaded, (doc, latest) => {
    if (loaded.expectedFingerprint && replayFingerprint(latest) !== loaded.expectedFingerprint)
      throw new Error(t('ledger.003'));
    // Validate against the state the rows will actually follow.
    const state = fold(latest, doc);
    const after = messageId(latest.message?.at(-1));
    for (const event of events) {
      const codex = ['skill', 'monster'].includes(event?.domain);
      const applied = codex ? Codex.applyEvent(state.codex, event) : Core.applyEvent(state.item.registry, event);
      if (applied == null) throw new Error(t('ledger.002'));
      doc.seq += 1;
      doc.manual.push({
        id: `m${doc.seq.toString(36)}`,
        a: after,
        d: codex ? 'codex' : 'item',
        e: Core.clone(event),
        l: label,
        r: review,
        s: doc.seq,
        t: Date.now()
      });
    }
  });
  setStatus(t('ledger.001', label, events.length));
  void emit('data-reset');
  return refresh ? rebuildCurrent() : null;
}

export async function saveHistoryPreference(loaded, update) {
  const active = await context();
  if (!active || active.key !== loaded.key) throw new Error(t('aux.011'));
  const result = await writeDocument(active, (doc) => {
    update(doc.prefs);
  });
  // Preferences are display policy: the fold is unchanged, only the inputs moved.
  loaded.prefs = result.doc.prefs;
  loaded.doc = result.doc;
  loaded.chat = result.chat;
  loaded.replayFingerprint = replayFingerprint(result.chat);
  updateCachedChat(loaded.key, result.chat);
  storeLoaded(loaded);
}

export function requireBackupIdle(chat) {
  if (!chat || chatIsStreaming(chat)) throw new Error(t('ledger.025'));
}

// What a backup preview promises not to have changed before its commit. An
// import is a rare explicit action, so it can afford to hash the whole chat.
const chatSignature = (chat) => Core.fnv1a(JSON.stringify(chat));

export async function exportCurrentBackup(key) {
  const ctx = await context();
  if (!ctx || ctx.key !== key) throw new Error(t('ledger.022'));
  requireBackupIdle(ctx.chat);
  const loaded = project(ctx, await settingsFor(ctx.character));
  // Only part of the chat is loaded and no state entry covers the rest.
  if (!loaded.grounded) throw new Error(t('ledger.partial-chat'));
  return Backup.capture(loaded);
}

export async function prepareBackupImport(text, key, mode = 'empty') {
  if (!['empty', 'replace'].includes(mode)) throw new Error(t('ledger.023'));
  const value = Backup.parse(text),
    ctx = await context();
  if (!ctx || ctx.key !== key) throw new Error(t('ledger.022'));
  requireBackupIdle(ctx.chat);
  const loaded = project(ctx);
  // Counted on part of the chat, an "empty" chat may not be empty at all.
  if (!loaded.grounded) throw new Error(t('ledger.partial-chat'));
  const previousCounts = [
    loaded.snapshot.registry.order.length,
    loaded.codexSnapshot.skills.order.length,
    loaded.codexSnapshot.monsters.order.length
  ];
  if (mode === 'empty' && previousCounts.some(Boolean)) throw new Error(t('ledger.021'));
  if (mode !== 'replace' && !Backup.counts(value).some(Boolean)) throw new Error(t('ledger.020'));
  return { value, key, mode, previousCounts, expected: chatSignature(ctx.chat) };
}

// A restore becomes the document's root: the state at the newest message,
// before every later one. Events, manual rows and entries so far are
// superseded by it, so the loaded anchors go too.
export async function commitBackupImport(preview) {
  const ctx = await context();
  if (!ctx || ctx.key !== preview.key) throw new Error(t('ledger.019'));
  requireBackupIdle(ctx.chat);
  if (chatSignature(ctx.chat) !== preview.expected) throw new Error(t('ledger.018'));
  const checked = await prepareBackupImport(JSON.stringify(preview.value), preview.key, preview.mode);
  if (checked.expected !== preview.expected) throw new Error(t('ledger.017'));
  await writeDocument(
    ctx,
    (doc, latest) => {
      if (chatSignature(latest) !== preview.expected) throw new Error(t('ledger.016'));
      const turn = fold(latest, doc).turn;
      const restored = Backup.restore(checked.value, turn);
      const last = (latest.message?.length || 0) - 1;
      doc.root = {
        x: {
          item: { registry: restored.item.registry, history: restored.item.history },
          codex: restored.codex,
          notes: {}
        },
        m: [],
        w: messageTime(latest.message?.[last]),
        i: windowOffset(latest) + last,
        t: turn
      };
      doc.prefs = restored.prefs;
      doc.restoredThrough = messageId(latest.message?.at(-1));
      doc.events = {};
      doc.manual = [];
      doc.states = [];
      if (preview.mode === 'replace') doc.lore = Lorebook.emptyLedger();
      return { chat: mapMessages(latest, stripAnchors).chat };
    },
    { idle: true }
  );
  void emit('data-reset');
  setStatus(preview.mode === 'replace' ? t('ledger.015') : t('ledger.014'));
  await rebuildCurrent();
  return checked.value;
}

// A copy of `chat` whose message texts went through `map`; messages that did
// not change are shared.
function mapMessages(chat, map) {
  let changed = 0;
  const message = (chat?.message || []).map((one) => {
    const field = typeof one?.data === 'string' ? 'data' : typeof one?.content === 'string' ? 'content' : '';
    if (!field) return one;
    const next = map(one[field]);
    if (next === one[field]) return one;
    changed += 1;
    return { ...one, [field]: next };
  });
  return { chat: changed ? { ...chat, message } : chat, changed };
}

const tidy = (text) => text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');

// Removes every ITEMX trace from the loaded chat: anchors, markers of earlier
// versions, stray transport tags and the document.
export function cleanChatPluginData(chat) {
  let removedMarkers = 0;
  const mapped = mapMessages(chat, (text) => {
    const count = anchorKeys(text).length + countOldMarkers(text);
    const next = tidy(stripTransport(stripOldMarkers(stripAnchors(text))));
    if (next === text) return text;
    removedMarkers += count;
    return next;
  });
  const scriptstate = { ...(chat?.scriptstate || {}) };
  let removedStateKeys = 0;
  if (Object.prototype.hasOwnProperty.call(scriptstate, DOCUMENT_KEY)) {
    delete scriptstate[DOCUMENT_KEY];
    removedStateKeys = 1;
  }
  return {
    chat: { ...mapped.chat, scriptstate },
    cleanedMessages: mapped.changed,
    removedMarkers,
    removedStateKeys
  };
}

async function requireIdleActive(errors) {
  const ctx = await context();
  if (!ctx) throw new Error(errors.missing);
  const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
  if (!latest) throw new Error(errors.unreadable);
  if (chatIsStreaming(latest)) throw new Error(errors.streaming);
  return { ctx, latest };
}

function forgetChatRuntime(ctx) {
  setLatestKeys([]);
  dropPending(pendingEntries(ctx.key).map(([key]) => key));
  workQueue.forget('catch-up');
  workQueue.forget('aux-settle');
  invalidateLoaded();
  void emit('data-reset');
}

export async function cleanCurrentChatItemx() {
  const { ctx, latest } = await requireIdleActive({
    missing: t('ui-settings.139'),
    unreadable: t('ledger.006'),
    streaming: t('ledger.010')
  });
  const cleaned = cleanChatPluginData(latest);
  await saveChat(ctx.characterIndex, ctx.chatIndex, cleaned.chat, latest);
  // Cleanup is for leaving ITEMX behind. Disable the bot only after the write
  // succeeded so catch-up cannot recreate what was just removed.
  await changeSettings(ctx.character, { enabled: false });
  forgetChatRuntime(ctx);
  setStatus(t('ledger.009', cleaned.removedMarkers));
  const loaded = await rebuildCurrent();
  if (loaded) loaded.enabled = false;
  return { ...cleaned, loaded };
}

export function itemxStorageFootprint(chat) {
  let anchorCount = 0;
  for (const message of chat?.message || []) {
    const text = Core.messageText(message);
    if (text.includes('<!--')) anchorCount += anchorKeys(text).length;
  }
  const { stateBytes } = footprint(chat);
  return { stateBytes, anchorCount, totalBytes: stateBytes };
}

// Why `chat` cannot be pruned (reader-facing), or '' when it can. A partially loaded chat
// may simply not show an anchor; a chat with branches keeps the cards of its
// other branches out of the message list.
export function pruneBlocker(chat) {
  if (windowOffset(chat)) return t('ledger.partial-chat');
  if (chat?.activeBranchId) return t('ledger.branch-chat');
  return '';
}

// Drops, in place on `doc`, what `chat` (fully loaded, without branches) shows
// to be gone: card events whose anchor stands in no message (rerolled,
// deleted or edited away) and aux guards of deleted messages, and rewrites
// frozen cards in their compact form. Events made during the newest turn are
// kept: a reroll candidate the reader may still swipe back to carries them.
// Returns the number of events removed.
export function pruneDocument(doc, chat) {
  const messages = chat?.message || [];
  const live = new Set(messages.flatMap((message) => anchorKeys(Core.messageText(message))));
  const ids = new Set(messages.map(messageId).filter(Boolean));
  // The newest turn starts at the last user message; an event committed after
  // it may belong to a reroll candidate. Rows from before 2.5.1 carry no
  // commit time and fall back to their sequence.
  let lastUser = -1;
  for (let index = messages.length - 1; index >= 0 && lastUser < 0; index -= 1)
    if (/^(?:user|human)$/i.test(String(messages[index]?.role || ''))) lastUser = index;
  const turnStart = Number(messages[lastUser]?.time) || 0;
  let settledSeq = 0;
  for (const message of messages.slice(0, Math.max(0, lastUser)))
    for (const key of anchorKeys(Core.messageText(message))) settledSeq = Math.max(settledSeq, doc.events[key]?.s || 0);
  const isCurrentTurn = (row) => (Number.isFinite(row.t) && turnStart ? row.t >= turnStart : (row.s || 0) > settledSeq);
  let removed = 0;
  for (const [key, row] of Object.entries(doc.events)) {
    if (live.has(key) || isCurrentTurn(row)) continue;
    delete doc.events[key];
    removed += 1;
  }
  for (const id of Object.keys(doc.guards.aux)) if (!ids.has(id)) delete doc.guards.aux[id];
  for (const row of Object.values(doc.events)) {
    const frozen = thaw(row);
    if (frozen) freeze(row, frozen.view, frozen.previous);
  }
  return removed;
}

// The settings action. Refuses what pruneBlocker refuses.
export async function compactCurrentChatStorage() {
  const { ctx, latest } = await requireIdleActive({
    missing: t('ui-settings.139'),
    unreadable: t('ledger.006'),
    streaming: t('ledger.010')
  });
  const blocked = pruneBlocker(latest);
  if (blocked) throw new Error(blocked);
  const before = footprint(latest).stateBytes;
  let removed = 0;
  await writeDocument(ctx, (doc, current) => {
    const again = pruneBlocker(current);
    if (again) throw new Error(again);
    removed = pruneDocument(doc, current);
  });
  invalidateLoaded();
  void emit('data-reset');
  const loaded = await rebuildCurrent();
  const after = footprint(loaded?.chat || latest).stateBytes;
  return { removed, savedBytes: Math.max(0, before - after), loaded };
}
