/* Lorebook enrichment of encounters: reads the host lorebook, folds matching
 * public entries into the encounter ledger. */
import * as Core from './engine/core.js';
import * as Lorebook from './engine/lorebook.js';
import { context, readChat, saveChat } from './chat-io.js';
import { ITEMX_LORE_KEY } from './config.js';
import { isUnloading } from './connection.js';
import { emit } from './events.js';
import { host } from './host.js';
import { t } from './i18n.js';
import { debugRecord, workQueue } from './kernel.js';
import { buildMessageEventLookup, rebuildCodexWithLedger, rebuildCurrent } from './ledger.js';
import { encounterRegistryFingerprint } from './portraits.js';
import { invalidateLoaded } from './session.js';
import { settingsFor } from './settings.js';
import { setStatus } from './status.js';
let lorebookCache = { key: '', at: 0, rows: [] };

export async function callOptionalRisuApi(name, ...args) {
  try {
    const method = host()[name];
    if (typeof method !== 'function') return { available: false, value: undefined };
    return { available: true, value: await method(...args) };
  } catch (error) {
    if (/API method\s+\S+\s+not found/i.test(String(error?.message || error || ''))) {
      return { available: false, value: undefined };
    }
    throw error;
  }
}

export async function lorebookEntries(contextKey, { refresh = false } = {}) {
  if (!refresh && lorebookCache.key === contextKey && lorebookCache.at && Date.now() - lorebookCache.at < 10000)
    return lorebookCache.rows;
  const response = await callOptionalRisuApi('getCurrentLorebookEntries');
  if (!response.available) {
    const error = new Error(t('ui-panel.136'));
    error.code = 'LOREBOOK_API_UNAVAILABLE';
    throw error;
  }
  const rows = Array.isArray(response.value)
    ? response.value
    : Array.isArray(response.value?.entries)
      ? response.value.entries
      : Array.isArray(response.value?.lorebook)
        ? response.value.lorebook
        : [];
  lorebookCache = { key: contextKey, at: Date.now(), rows };
  return rows;
}

export async function enrichPendingChat(ctx, chat) {
  // This derived update can share the transport write; no host mutation here.
  try {
    const settings = await settingsFor(ctx.character);
    if (!settings.encountersEnabled || !settings.lorebookEncounterEnabled) return chat;
    const entries = await lorebookEntries(ctx.key);
    const active = await context();
    if (!active || active.key !== ctx.key) return chat;
    const base = rebuildCodexWithLedger(chat, buildMessageEventLookup(chat));
    const scanned = Lorebook.scan(base, entries, Lorebook.read(chat));
    if (!scanned.result.enriched && !scanned.result.removed) return chat;
    return { ...chat, scriptstate: { ...chat.scriptstate, [ITEMX_LORE_KEY]: JSON.stringify(scanned.ledger) } };
  } catch (error) {
    // Optional enrichment must not prevent committing authoritative events.
    debugRecord('pending lore enrichment', error?.message || String(error));
    return chat;
  }
}

export async function scanLorebookEncounters({ refresh = false, silent = false } = {}) {
  const pending = (async () => {
    const ctx = await context();
    if (!ctx) throw new Error(t('ui-panel.135'));
    const entries = await lorebookEntries(ctx.key, { refresh });
    const active = await context();
    if (!active || active.key !== ctx.key) throw new Error(t('ui-panel.134'));
    const scanResult = await (async () => {
      const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
      if (!latest) throw new Error(t('ui-panel.133'));
      if (latest.isStreaming || (latest.message || []).some((message) => message?.isStreaming || message?.bgContinue)) {
        throw new Error(t('ui-panel.132'));
      }
      const lookup = buildMessageEventLookup(latest);
      const base = rebuildCodexWithLedger(latest, lookup);
      const previous = Lorebook.read(latest);
      const sourceFingerprint = `${ctx.key}:${encounterRegistryFingerprint(base)}:${Core.fnv1a(JSON.stringify(entries))}:${Core.fnv1a(JSON.stringify(previous.rows))}`;
      if (!refresh && silent && workQueue.revision('lorebook') === sourceFingerprint)
        return { changed: false, sourceFingerprint, result: { enriched: 0, removed: 0, matched: 0, ambiguous: 0 } };
      const scanned = Lorebook.scan(base, entries, previous);
      if (!scanned.result.enriched && !scanned.result.removed) return { ...scanned, changed: false, sourceFingerprint };
      const next = Core.clone(latest);
      next.scriptstate = { ...(next.scriptstate || {}), [ITEMX_LORE_KEY]: JSON.stringify(scanned.ledger) };
      await saveChat(ctx.characterIndex, ctx.chatIndex, next, latest);
      return {
        ...scanned,
        changed: true,
        sourceFingerprint: `${ctx.key}:${encounterRegistryFingerprint(base)}:${Core.fnv1a(JSON.stringify(entries))}:${Core.fnv1a(JSON.stringify(scanned.ledger.rows))}`
      };
    })();
    const current = await context();
    if (isUnloading() || current?.key !== ctx.key) return scanResult;
    if (scanResult.changed) {
      invalidateLoaded();
      await emit('data-reset');
      await rebuildCurrent();
    }
    const summary = scanResult.result;
    workQueue.remember('lorebook', scanResult.sourceFingerprint);
    if (!silent || summary.enriched || summary.removed)
      setStatus(t('ui-panel.131', summary.enriched, summary.removed, summary.matched, summary.ambiguous));
    debugRecord('lorebook scan', summary);
    if (!silent)
      await emit('notify', {
        message: t(
          'ui-panel.129',
          summary.enriched,
          summary.removed,
          summary.matched,
          summary.ambiguous ? t('ui-panel.130', summary.ambiguous) : ''
        ),
        tone: 'success'
      });
    return scanResult;
  })().catch(async (error) => {
    if (!silent) await emit('notify', { message: t('ui-panel.128', error.message || error), tone: 'error' });
    else debugRecord('automatic lorebook scan skipped', error?.message || String(error));
    return null;
  });
  return pending;
}
