/* Lorebook enrichment of encounters: reads the host lorebook, folds matching
 * public entries into the encounter ledger. */
import * as Core from './engine/core.js';
import * as Lorebook from './engine/lorebook.js';
import { context } from './chat-io.js';
import { isUnloading } from './connection.js';
import { emit } from './events.js';
import { host } from './host.js';
import { t } from './i18n.js';
import { debugRecord, workQueue } from './kernel.js';
import { rebuildCurrent, writeDocument } from './ledger.js';
import { encounterRegistryFingerprint } from './portraits.js';
import { settingsFor } from './settings.js';
import { setStatus } from './status.js';
import { fold } from './store/replay.js';
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

// Folds lorebook enrichment into `doc` (being written with `chat`), so the
// enrichment shares the commit's single write. Never blocks the commit.
export async function enrichLore(ctx, doc, chat) {
  try {
    const settings = await settingsFor(ctx.character);
    if (!settings.encountersEnabled || !settings.lorebookEncounterEnabled) return;
    const entries = await lorebookEntries(ctx.key);
    const base = fold(chat, doc).codex;
    const scanned = Lorebook.scan(base, entries, doc.lore);
    if (scanned.result.enriched || scanned.result.removed) doc.lore = scanned.ledger;
  } catch (error) {
    debugRecord('pending lore enrichment', error?.message || String(error));
  }
}

export async function scanLorebookEncounters({ refresh = false, silent = false } = {}) {
  const pending = (async () => {
    const ctx = await context();
    if (!ctx) throw new Error(t('ui-settings.139'));
    const entries = await lorebookEntries(ctx.key, { refresh });
    const active = await context();
    if (!active || active.key !== ctx.key) throw new Error(t('ui-panel.134'));
    let scanned = null;
    const written = await writeDocument(ctx, (doc, latest) => {
      const base = fold(latest, doc).codex;
      const sourceFingerprint = `${ctx.key}:${encounterRegistryFingerprint(base)}:${Core.fnv1a(JSON.stringify(entries))}:${Core.fnv1a(JSON.stringify(doc.lore.rows))}`;
      if (!refresh && silent && workQueue.revision('lorebook') === sourceFingerprint) {
        scanned = { changed: false, sourceFingerprint, result: { enriched: 0, removed: 0, matched: 0, ambiguous: 0 } };
        return false;
      }
      const result = Lorebook.scan(base, entries, doc.lore);
      if (!result.result.enriched && !result.result.removed) {
        scanned = { ...result, changed: false, sourceFingerprint };
        return false;
      }
      doc.lore = result.ledger;
      scanned = {
        ...result,
        changed: true,
        sourceFingerprint: `${ctx.key}:${encounterRegistryFingerprint(base)}:${Core.fnv1a(JSON.stringify(entries))}:${Core.fnv1a(JSON.stringify(result.ledger.rows))}`
      };
    });
    const scanResult = scanned;
    if (!written && !scanResult) throw new Error(t('ui-panel.133'));
    const current = await context();
    if (isUnloading() || current?.key !== ctx.key) return scanResult;
    if (scanResult.changed) {
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
