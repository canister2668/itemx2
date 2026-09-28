/* Model pipeline: request protocol injection, output anchoring and the commit
 * of a finished response into the ledger document. Emits `chat-synced` for
 * the UI to follow. */
import * as Codex from './engine/codex.js';
import * as Core from './engine/core.js';
import * as EntityHistory from './engine/history.js';
import { scrollActive } from './activity.js';
import {
  assistantMessageIndex,
  automaticAuxReady,
  automaticAuxSettled,
  auxActive,
  recoverAuxiliaryOutput
} from './aux.js';
import { context } from './chat-io.js';
import { ITEMX_AUX_AUTO_ATTEMPTS, ITEMX_AUX_SETTLE_MS } from './config.js';
import { hookState, isUnloading } from './connection.js';
import { emit } from './events.js';
import { t } from './i18n.js';
import { debugRecord, dispatch, fail, workQueue } from './kernel.js';
import { cachedOrRebuildCurrent, commitRecords, rebuildCurrent, writeDocument } from './ledger.js';
import { enrichLore, scanLorebookEncounters } from './lore-sync.js';
import { encounterEntities, modulePortraitAssets, prepareInlinePortraits } from './portraits.js';
import { activeContextKey, addPending, dropPending, pendingRecord, setLatestKeys } from './session.js';
import { isEnabled, settingsFor } from './settings.js';
import { setStatus } from './status.js';
import { anchorKeys, stripTransport } from './store/anchors.js';
import { readCache } from './store/document.js';
import { fold } from './store/replay.js';
import { RAW_TRANSPORT_RE, anchorize, enabledCodexDomains, protocolForSettings, requestSafeText } from './transport.js';

export function mainRequestType(type) {
  return !/(translate|emotion|memory|otherax|aux|submodel|image|tts)/i.test(String(type || ''));
}

export function requestEndsWithModelTurn(messages) {
  if (!Array.isArray(messages) || !messages.length) return false;
  const last = messages[messages.length - 1] || {};
  const role = String(last.role || '').trim();
  // Risu's Google formatter handles multimodal messages before its normal
  // role switch and maps every non-user multimodal turn to Gemini `model`.
  if (Array.isArray(last.multimodals) && last.multimodals.length > 0) {
    return !/^(?:user|human)$/i.test(role);
  }
  return /^(?:assistant|model|char)$/i.test(role);
}

export function injectRequestProtocol(messages, instruction) {
  const protocol = { role: 'system', content: instruction, name: 'ITEMX_2_PROTOCOL' };
  // Risu's Google formatter converts a non-leading system turn following a
  // model turn into a user turn. This preserves continuation semantics while
  // satisfying Gemini's requirement that requests never end with model.
  return requestEndsWithModelTurn(messages) ? [...messages, protocol] : [protocol, ...messages];
}

// Seed of the anchor keys of the response being generated in `loaded`'s chat:
// the triggering user message and the document revision, both stable for
// every flush and hook pass of one response.
function turnSeed(loaded) {
  const messages = loaded.chat?.message || [];
  let user = '';
  for (let index = messages.length - 1; index >= 0 && !user; index -= 1)
    if (/^(?:user|human)$/i.test(String(messages[index]?.role || ''))) user = messages[index].chatId || `u${index}`;
  return `${loaded.key}|${user}|${loaded.doc.seq}`;
}

export function scheduleLegacyCommitRecovery(confirm = false) {
  if (auxActive() > 0) return;
  workQueue.clearTimer('legacyCommitTimer');
  workQueue.schedule(
    'legacyCommitTimer',
    async () => {
      try {
        await catchUpLatestOutput({ syncUi: false });
        await syncAfterCommit();
        if (!confirm && auxActive() === 0) scheduleLegacyCommitRecovery(true);
      } catch (error) {
        fail('legacy commit recovery', error);
      }
    },
    1800,
    false
  );
}

// Commits the latest response: its anchors whose parsed records are pending
// become document events owned by the message, and raw tags the output hook
// never saw are anchored now. One write, lore enrichment included.
export async function commitLatestOutput(ctx) {
  const index = assistantMessageIndex(ctx.chat);
  if (index < 0) return { ctx, index, changed: false };
  const source = Core.messageText(ctx.chat.message[index]);
  const pending = anchorKeys(source).filter((key) => pendingRecord(key)?.chatKey === ctx.key);
  const raw = RAW_TRANSPORT_RE.test(source);
  if (!pending.length && !raw) return { ctx, index, changed: false };
  const settings = await settingsFor(ctx.character);
  let events = 0,
    errors = 0;
  const result = await writeDocument(ctx, async (doc, latest) => {
    const message = latest.message?.[index];
    if (Core.messageText(message) !== source) return false;
    const chatId = typeof message?.chatId === 'string' ? message.chatId : '';
    commitRecords(
      doc,
      pending.filter((key) => !doc.events[key]).map((key) => ({ key, ...pendingRecord(key) })),
      chatId
    );
    let text = source;
    if (raw) {
      const state = fold(latest, doc, { checkpoint: readCache(latest)?.checkpoint || null });
      const anchored = anchorize(source, {
        state: { registry: state.item.registry, codex: state.codex },
        settings,
        seed: `${ctx.key}|${index}|repair|${doc.seq}`,
        doc
      });
      commitRecords(doc, anchored.records, chatId);
      text = anchored.content;
      events = anchored.events;
      errors = anchored.errors;
    }
    const field = typeof message.data === 'string' ? 'data' : 'content';
    const chat =
      text === source
        ? latest
        : { ...latest, message: latest.message.map((one, at) => (at === index ? { ...one, [field]: text } : one)) };
    await enrichLore(ctx, doc, chat);
    return { chat };
  });
  if (!result) return { ctx, index, changed: false };
  dropPending(pending);
  const stillActive = activeContextKey() === ctx.key;
  if (stillActive) {
    workQueue.remember('host-settling', ctx.key);
    void emit('data-reset');
    if (raw) setStatus(errors ? t('pipeline.010', errors) : t('pipeline.009', events));
  }
  debugRecord('commit output', { committed: pending.length, repaired: raw, events, errors });
  return { ctx: { ...ctx, chat: result.chat }, index, changed: true };
}

export async function catchUpLatestOutput({ syncUi = true } = {}) {
  if (!activeContextKey() || auxActive() > 0 || scrollActive()) return;
  let ctx = await context();
  if (!ctx || !(await isEnabled(ctx.character))) return;
  const index = assistantMessageIndex(ctx.chat);
  if (index < 0) return;
  const source = Core.messageText(ctx.chat.message[index]);
  if (!automaticAuxReady(ctx.chat, index, source)) return;
  // The finished response is committed at once; only the auxiliary pass waits
  // for the text to settle.
  const committed = await commitLatestOutput(ctx);
  ctx = committed.ctx;
  if (activeContextKey() !== ctx.key) return;
  if (!automaticAuxSettled(ctx, index, Core.messageText(ctx.chat.message[index]))) {
    // The first sighting never counts as settled. Without this re-check the listener path
    // waits for the 45 s watchdog before the auxiliary pass runs.
    workQueue.schedule(
      'auxSettleTimer',
      () => catchUpLatestOutput({ syncUi }).catch((error) => fail('aux settle re-check', error)),
      ITEMX_AUX_SETTLE_MS + 150
    );
    if (committed.changed && syncUi) await syncAfterCommit();
    return;
  }
  const messageId = ctx.chat.message?.[index]?.chatId || `idx-${index}`;
  const attempt = await workQueue.attempt(
    'catch-up',
    `${ctx.key}:${index}:msg-${messageId}`,
    () => recoverAuxiliaryOutput({ messageIndex: index }),
    Array.isArray,
    Infinity,
    ITEMX_AUX_AUTO_ATTEMPTS
  );
  if (attempt.skipped && !committed.changed) return;
  if (syncUi) await syncAfterCommit();
}

// After a commit: rebuild the projection, apply lorebook enrichment, and let the
// UI (event bursts, drawer) follow the new state.
export async function syncAfterCommit() {
  const loaded = await rebuildCurrent();
  if (loaded?.encountersEnabled && loaded?.lorebookEncounterEnabled) await scanLorebookEncounters({ silent: true });
  await emit('chat-synced', loaded);
  return loaded;
}

export function scheduleCommittedOutputSync() {
  return dispatch(
    'committed-output',
    async () => {
      await catchUpLatestOutput({ syncUi: false });
      await syncAfterCommit();
    },
    false,
    { ready: () => !scrollActive() }
  ).catch((error) => fail('chat listener', error));
}

export function armCatchUpWatchdog() {
  if (isUnloading()) return;
  workQueue.clearTimer('catchUpTimer');
  const interval = hookState('listener') === true ? 45000 : 4500;
  workQueue.schedule(
    'catchUpTimer',
    () => {
      return catchUpLatestOutput().catch((error) => fail('latest output catch-up', error));
    },
    interval,
    true
  );
}

export const beforeRequest = async (messages, type) => {
  // Translation is a view of the original response, not a new world-state
  // request; its text is left as the host built it.
  if (/translate/i.test(String(type || ''))) return messages || [];
  const safeMessages = (messages || []).map((message) =>
    typeof message?.content === 'string' ? { ...message, content: requestSafeText(message.content) } : message
  );
  if (!mainRequestType(type)) return safeMessages;
  try {
    const loaded = await cachedOrRebuildCurrent();
    if (!loaded || !(await isEnabled(loaded.character))) return safeMessages;
    const settings = await settingsFor(loaded.character);
    if (!settings.mainOutput) return safeMessages;
    if (!settings.itemsEnabled && !settings.skillsEnabled && !settings.encountersEnabled) return safeMessages;
    const recent = safeMessages
      .slice(-4)
      .map((message) => message.content || '')
      .join('\n');
    const domains = enabledCodexDomains(settings);
    const moduleAssets = settings.encountersEnabled
      ? await modulePortraitAssets(settings, loaded.character, loaded.chat)
      : [];
    const instruction = `${protocolForSettings(settings, loaded.character, moduleAssets, { narrative: recent, entities: encounterEntities(loaded.codexSnapshot) })}${settings.itemsEnabled ? `\n\n${Core.anchor(EntityHistory.requestSnapshot(loaded, recent))}` : ''}${domains.length ? `\n\n${Codex.anchor(loaded.codexSnapshot, recent, 9000, { enabledDomains: domains })}` : ''}`;
    debugRecord('beforeRequest', {
      items: settings.itemsEnabled,
      skills: settings.skillsEnabled,
      encounters: settings.encountersEnabled,
      messages: safeMessages.length
    });
    return injectRequestProtocol(safeMessages, instruction);
  } catch (error) {
    fail('beforeRequest', error);
    return safeMessages;
  }
};

export const processHandler = async (content) => requestSafeText(content);

// Anchors a model response. The parsed records wait in the session until the
// finished response is committed; the display hook renders them meanwhile.
export async function processOutput(content, type) {
  if (!mainRequestType(type)) return content;
  content = Core.stripInventoryEcho(content);
  // Streaming calls this per flush. Without a raw tag there is nothing to parse.
  if (!RAW_TRANSPORT_RE.test(content)) return content;
  try {
    const loaded = await cachedOrRebuildCurrent();
    if (!loaded) return content;
    if (!(await isEnabled(loaded.character)) || !loaded.mainOutput) return stripTransport(content);
    const result = anchorize(content, {
      state: { registry: loaded.snapshot.registry, codex: loaded.codexSnapshot },
      settings: loaded,
      seed: turnSeed(loaded),
      doc: loaded.doc
    });
    for (const record of result.records) addPending(record.key, { ...record, chatKey: loaded.key });
    prepareInlinePortraits(loaded, result.codexSnapshot, loaded);
    if (result.records.length || result.errors) {
      const keys = result.records.map((record) => record.key);
      setLatestKeys(keys);
      void emit('markers');
      void emit('markers-armed', keys);
      setStatus(result.errors ? t('pipeline.008', result.errors) : t('pipeline.007', result.events));
      debugRecord('processOutput', { events: result.events, errors: result.errors });
    }
    return result.content;
  } catch (error) {
    fail('processOutput', error);
    return stripTransport(content);
  }
}

export const afterRequest = async (content, type) => processOutput(content, type);

export const outputFallback = async (content) => {
  const processed = await processOutput(content, 'main');
  if (hookState('listener') === 'unsupported' && auxActive() === 0) scheduleLegacyCommitRecovery();
  return processed;
};
