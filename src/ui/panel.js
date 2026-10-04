/* The drawer: badge, inventory, codex and settings tabs, history pane and the
 * click router. */
import * as Core from '../engine/core.js';
import * as EntityHistory from '../engine/history.js';
import * as Renderer from '../render/renderer.js';
import { endOutputWindow, outputActive, scrollActive } from '../activity.js';
import { auxActive, auxRunning, cancelAux, repairOneItem, runItemModel } from '../aux.js';
import { context } from '../chat-io.js';
import { ITEMX_ROOT_PAGE_SIZE, ITEMX_VERSION_LABEL } from '../config.js';
import { hookState, isUnloading, lastError, updateState } from '../connection.js';
import { installPipelineHooks } from '../hooks.js';
import { host } from '../host.js';
import { t } from '../i18n.js';
import { debugRecord, delay, dispatch, entry, fail, log, phaseReport, workQueue } from '../kernel.js';
import {
  anchorPayload,
  cachedOrRebuildCurrent,
  commitManualEvents,
  presentationRecord,
  rebuildCurrent,
  replayFingerprint,
  saveHistoryPreference
} from '../ledger.js';
import { createLru } from '../lru.js';
import { loadCodexPortraits, resetPortraitContext } from '../portraits.js';
import {
  codexHeroFx,
  codexListFx,
  encounterEmoji,
  encounterFxClasses,
  skillEmoji,
  skillFxClasses,
  skillRankTier,
  skillTheme,
  themeText
} from '../render/codex-cards.js';
import {
  activeContextKey,
  cachedLoaded,
  currentGeneration,
  currentLatestKeys,
  freshLoaded,
  invalidateLoaded,
  setActiveContextKey,
  setLatestKeys
} from '../session.js';
import { FONT_SCALES, badgePositionSetting, isEnabled, settingsFor } from '../settings.js';
import { setStatus, status } from '../status.js';
import { auxWorkingLabel, connectionSummary } from './controls.js';
import {
  clearEventBursts,
  clearMarkerHtmlCache,
  effectsMotion,
  flushEventBursts,
  forgetBodyEffectOwner,
  installBodyEffectGovernor,
  resetScrollEffects
} from './presentation.js';
import {
  SETTINGS_SKINS,
  openBackupPanel,
  rootSettingActions,
  settingsDebugLog,
  settingsDomainControls,
  settingsFontChoices,
  settingsPanelHtml,
  settingsPositionChoices,
  settingsStorageParts,
  syncPowerUi
} from './settings.js';
import { SKIN_NAMES, ensureMainStyleAttached, fallbackDocumentHead, installMainStyle, mainDoc } from './style.js';
import { nativeElement, panelDocument } from './surface.js';
import { uiState } from './view-state.js';
import { checkForUpdate } from '../update-check.js';

// Rendered item / codex detail bodies, keyed by content.
const detailHtmlCache = createLru(60);
let hostObserver = null;
let hostSettingsCache = { at: 0, visible: false };

export const detailHtmlCacheSize = () => detailHtmlCache.size;

export function clearDetailHtmlCache() {
  detailHtmlCache.clear();
}

export async function disconnectHostObserver() {
  const observer = hostObserver;
  hostObserver = null;
  try {
    if (observer?.disconnect) await observer.disconnect();
  } catch {}
}

export function itemsOf(snapshot) {
  const reg = snapshot?.registry || Core.newRegistry();
  return reg.order.map((id) => reg.items[id]).filter(Boolean);
}

export function rootPageItems(loaded) {
  const all = itemsOf(loaded?.snapshot)
    .filter((item) => !EntityHistory.terminal('item', item))
    .filter(matches)
    .slice(0, 60);
  const pageCount = Math.max(1, Math.ceil(all.length / ITEMX_ROOT_PAGE_SIZE));
  uiState.rootItemPage = Math.max(0, Math.min(pageCount - 1, uiState.rootItemPage));
  const start = uiState.rootItemPage * ITEMX_ROOT_PAGE_SIZE;
  return all.slice(start, start + ITEMX_ROOT_PAGE_SIZE);
}

export function detailAnnotations(domain, entity) {
  const record = presentationRecord(domain, entity.id);
  const changes = Renderer.changesHtml(record.previous, entity, domain);
  const review = Renderer.reviewHtml(record.review, entity);
  const repair =
    domain === 'item' && record.review?.missing?.length
      ? `<button class="itemx2-repair-one">${t('ui-panel.repair-one')}</button>`
      : '';
  return `${changes}${review}${repair}`;
}

export function itemDetailHtml(item) {
  const motion = effectsMotion();
  const record = presentationRecord('item', item.id);
  const key = `${item.id}:${Core.fnv1a(JSON.stringify([item, record.previous, record.review]))}:${motion}`;
  const cached = detailHtmlCache.get(key);
  if (cached !== undefined) return cached;
  const html = `<div class="itemx2-detail-stack">${Renderer.renderCard(item, { motion })}${detailAnnotations('item', item)}</div>`;
  detailHtmlCache.set(key, html);
  return html;
}

export async function hydrateCheckedItemDetail(loaded) {
  if (!panelDocument() || !loaded) return false;
  const detailItems = rootPageItems(loaded);
  for (let index = 0; index < detailItems.length; index += 1) {
    const selected = await panelDocument().querySelector(`#itemx2-detail-${index}:checked`);
    if (!selected) continue;
    const html = itemDetailBodyHtml(detailItems[index]);
    return fillDetailBody(`itemx2-root-detail-body-${index}`, Core.fnv1a(html), () => html);
  }
  return false;
}

export function codexEntries(loaded, domain) {
  return EntityHistory.currentEntities(loaded, domain).filter(matches).slice(0, 60);
}

// Manual deletion for items, skills and encounters. Models sometimes record one thing under
// several ids; merging guesses wrong, so the reader removes the extra entries. The removal is
// a manual ledger row replayed after the markers that keep re-reading those entries.
// `${domain}:${id}` of the entry awaiting its yes / no answer.
export let deleteArmed = '';
// Literal keys: the catalog test checks every t() key statically.
export const DELETE_TEXT = {
  item: [t('ui-panel.item-delete'), t('ui-panel.item-delete-confirm')],
  skill: [t('ui-panel.skill-delete'), t('ui-panel.skill-delete-confirm')],
  monster: [t('ui-panel.monster-delete'), t('ui-panel.monster-delete-confirm')]
};
export function entityDeleteHtml(domain, armed) {
  const [label, question] = DELETE_TEXT[domain];
  return armed
    ? `<div class="itemx2-codex-delete"><span class="itemx2-confirm-row"><small>${question}</small><span class="itemx2-manager-actions"><button class="itemx2-root-setting-button itemx2-setting-danger itemx2-entity-delete-yes" type="button">${t('ui-settings.confirm-yes-cleanup')}</button><button class="itemx2-root-setting-button itemx2-entity-delete-no" type="button">${t('ui-settings.confirm-no')}</button></span></span></div>`
    : `<div class="itemx2-codex-delete"><button class="itemx2-root-setting-button itemx2-entity-delete" type="button">${label}</button></div>`;
}
export function itemDetailBodyHtml(item) {
  // Inside the stack, under the card: as a sibling it became a second flex column.
  const block = entityDeleteHtml('item', deleteArmed === `item:${item.id}`);
  return itemDetailHtml(item).replace(/<\/div>$/, () => `${block}</div>`);
}
export async function selectedCodexEntity(domain, loaded) {
  const marker = await panelDocument()?.querySelector(
    `.x-risu-itemx2-${domain}-entry-choice:checked ~ .x-risu-itemx2-${domain}-detail .x-risu-itemx2-codex-detail-index`
  );
  if (!marker) return null;
  return codexEntries(loaded, domain)[Number(await marker.textContent())] || null;
}
export async function selectedItem(loaded) {
  const items = rootPageItems(loaded);
  for (let index = 0; index < items.length; index += 1)
    if (await panelDocument()?.querySelector(`#itemx2-detail-${index}:checked`)) return items[index];
  return null;
}
export function deleteEvent(domain, id) {
  if (domain === 'skill') return { domain, kind: 'patch', patch: { id, action: null, op: 'remove', fields: {} } };
  // An ended encounter still lists in the bestiary, so encounters are purged outright.
  if (domain === 'monster')
    return { domain, kind: 'patch', manual: true, patch: { id, action: null, op: 'purge', fields: {} } };
  return {
    kind: 'patch',
    patch: {
      id,
      action: null,
      op: 'remove',
      fields: {},
      quantity: null,
      destination: '',
      reason: 'manual_remove',
      slot: null,
      inputs: null,
      outputs: null,
      equip: null,
      unequip: null
    }
  };
}
export async function routeEntityDelete(event, loaded, domain) {
  const yes = await eventHitsMainClass(event, 'itemx2-entity-delete-yes');
  const no = !yes && (await eventHitsMainClass(event, 'itemx2-entity-delete-no'));
  const ask = !yes && !no && (await eventHitsMainClass(event, 'itemx2-entity-delete'));
  if (!yes && !no && !ask) return false;
  const entity = domain === 'item' ? await selectedItem(loaded) : await selectedCodexEntity(domain, loaded);
  if (!entity) return true;
  if (ask || no) {
    deleteArmed = ask ? `${domain}:${entity.id}` : '';
    if (domain === 'item') await hydrateCheckedItemDetail(loaded);
    else await hydrateCheckedCodexDetail(domain, loaded);
    return true;
  }
  deleteArmed = '';
  try {
    await commitManualEvents(loaded, [deleteEvent(domain, entity.id)], t('ui-panel.delete-label'));
    await showRootFeedback(t('ui-panel.delete-done', entity.name || entity.id), 'success', 3200);
  } catch (error) {
    await notifyUser(t('ui-panel.delete-failed', error.message || error), 'error');
  }
  await openRootInventory({ open: true, tab: uiState.activeRootTab });
  return true;
}

export async function hydrateCheckedCodexDetail(domain, loaded) {
  if (!panelDocument() || !loaded || !['skill', 'monster'].includes(domain)) return false;
  const marker = await panelDocument().querySelector(
    `.x-risu-itemx2-${domain}-entry-choice:checked ~ .x-risu-itemx2-${domain}-detail .x-risu-itemx2-codex-detail-index`
  );
  if (!marker) return false;
  const index = Number(await marker.textContent());
  const entity = codexEntries(loaded, domain)[index];
  if (!entity) return false;
  // The list may have been rendered from a shallow copy of cachedLoaded.
  // Resolve the selected portrait independently instead of trusting that copy.
  let portrait = domain === 'monster' ? loaded.portraits?.[entity.id] || '' : '';
  if (domain === 'monster' && !portrait) {
    const portraits = await loadCodexPortraits(
      loaded.character,
      loaded.chat,
      { monsters: { order: [entity.id], entries: { [entity.id]: entity } } },
      loaded
    );
    portrait = portraits[entity.id] || '';
  }
  if (loaded.key !== activeContextKey()) return false;
  const deleting = deleteArmed === `${domain}:${entity.id}`;
  return fillDetailBody(
    `itemx2-root-${domain}-detail-body-${index}`,
    `${codexDetailCacheKey(domain, entity, portrait, loaded.rarityMode)}:${deleting ? 'confirm' : ''}`,
    () =>
      `<span class="itemx2-codex-detail-index">${index}</span>${rootCodexDetailHtml(domain, entity, portrait, loaded.rarityMode)}${entityDeleteHtml(domain, deleting)}`
  );
}

// What each detail body of the current drawer render holds. Every tap inside
// the drawer re-enters the hydrators; re-injecting the same card would restart
// its effects and scroll. Keyed by body, so a card is never assumed to be in a
// body it was not written to. A drawer render clears it.
const filledBodies = new Map();
export function forgetDetailBodies() {
  filledBodies.clear();
}
async function fillDetailBody(className, key, html) {
  if (filledBodies.get(className) === key) return true;
  const detail = await queryMainClass(className);
  if (!detail) return false;
  await detail.setInnerHTML(html());
  filledBodies.set(className, key);
  return true;
}

export async function queryMainClass(className) {
  if (!panelDocument()) return null;
  // Host DOM is prefixed; the plugin's own iframe fallback (itemx2-frame) is not.
  return (
    (await panelDocument().querySelector(`.x-risu-${className}`)) ||
    (await panelDocument().querySelector(`.${className}`))
  );
}

export async function removeRootClickRouter() {
  const owner = uiState.rootClickBindings[0]?.owner;
  const bindings = uiState.rootClickBindings.slice();
  if (owner)
    for (const binding of bindings) {
      try {
        await owner.removeEventListener(binding.type, binding.id, binding.capture);
      } catch (error) {
        debugRecord('root click remove', error?.message || String(error));
      }
    }
  uiState.rootClickBindings = [];
}

export async function removeRootDrawer() {
  uiState.historyView.open = false;
  workQueue.clearTimer('feedbackTimer');
  await removeRootClickRouter();
  try {
    if (uiState.rootDrawer) await uiState.rootDrawer.remove();
  } catch {}
  if (mainDoc()) {
    try {
      const safeRoots = await mainDoc().querySelectorAll('[x-itemx2-drawer="owner"]');
      const roots = await host().unwarpSafeArray(safeRoots);
      for (const root of roots) {
        try {
          await root.remove();
        } catch {}
      }
    } catch (error) {
      fail('remove duplicate root drawers', error);
    }
  }
  uiState.rootDrawer = null;
  uiState.rootOpen = false;
  workQueue.remember('render', '');
}

export async function mountRootLoading(label = t('runtime.007')) {
  if (!mainDoc()) return false;
  await removeRootDrawer();
  const root = await mainDoc().createElement('div');
  await root.setAttribute('x-itemx2-drawer', 'owner');
  await root.setClassName('x-risu-itemx2-root-drawer x-risu-itemx2-booting');
  await root.setInnerHTML(
    `<div class="itemx2-boot-card" role="status" aria-live="polite"><i></i><span><strong>${Core.esc(label)}</strong><small>${t('ui-panel.137.1')}</small></span></div>`
  );
  const body = await mainDoc().querySelector('body');
  if (!body) return false;
  await body.appendChild(root);
  uiState.rootDrawer = root;
  workQueue.forget('render');
  return true;
}

export async function updateRootLoading(label) {
  if (!mainDoc() || !uiState.rootDrawer) return;
  try {
    const target = await mainDoc().querySelector('.x-risu-itemx2-boot-card strong');
    if (target) await target.setTextContent(label);
  } catch (error) {
    fail('loading label', error);
  }
}

export async function showRootFeedback(message, tone = 'success', timeoutMs = 2600) {
  // Toasts belong to the open panel; with the drawer closed there is nowhere to show one.
  const doc = panelDocument();
  if (!doc || !(uiState.panelOpen || (uiState.rootDrawer && uiState.rootOpen))) return false;
  try {
    const toast = (await doc.querySelector('.x-risu-itemx2-feedback')) || (await doc.querySelector('.itemx2-feedback'));
    if (!toast) return false;
    workQueue.clearTimer('feedbackTimer');
    await toast.setTextContent(message);
    for (const value of ['success', 'error', 'working']) await toast.removeClass(`x-risu-itemx2-feedback-${value}`);
    await toast.addClass(`x-risu-itemx2-feedback-${tone}`);
    await toast.addClass('x-risu-itemx2-feedback-on');
    if (timeoutMs > 0) {
      workQueue.schedule(
        'feedbackTimer',
        () => {
          void toast.removeClass('x-risu-itemx2-feedback-on').catch(() => {});
        },
        timeoutMs,
        false
      );
    }
    return true;
  } catch (error) {
    fail('root feedback', error);
    return false;
  }
}

export async function notifyUser(message, tone = 'error') {
  if (await showRootFeedback(message, tone, tone === 'error' ? 4200 : 2600)) return true;
  log(message);
  return false;
}

export async function confirmUser(message) {
  try {
    if (typeof globalThis.confirm === 'function') return globalThis.confirm(message) === true;
  } catch (error) {
    fail('browser confirmation', error);
  }
  return false;
}

// Scroll completion may skip a closed drawer. It must not coalesce away a
// full refresh scheduled by a host mutation while scrolling was active.
export function scheduleHostDomSync(delayMs = 320, { light = false } = {}) {
  workQueue.schedule(
    light ? 'hostLightSyncTimer' : 'hostSyncTimer',
    async () => {
      try {
        if (await deferForOutput()) return;
        await installBodyEffectGovernor();
        if (!light || uiState.rootOpen) await ensureRootInventory();
        await syncHostSettingsVisibility();
        await flushEventBursts();
      } catch (error) {
        debugRecord('host DOM sync', error?.message || String(error));
      }
    },
    delayMs,
    false,
    () => !scrollActive()
  );
}

export async function installHostObserver() {
  if (!mainDoc() || hostObserver || typeof host().createMutationObserver !== 'function') return;
  try {
    const body = await mainDoc().querySelector('body');
    if (!body) return;
    // Streaming and every chat repaint fire this. It never queues work and
    // classifies at most two records: mutations confined to our own drawer are
    // ignored, anything else schedules one debounced host sync.
    hostObserver = await host().createMutationObserver(async (recordsSafe) => {
      if (isUnloading()) return;
      // A streaming flush repaints the message: classifying its records would
      // cost bridge round trips per flush. The debounced sync decides instead.
      if (scrollActive() || outputActive()) return scheduleHostDomSync();
      try {
        const records = await host().unwarpSafeArray(recordsSafe);
        const sample = records.length > 1 ? [records[0], records.at(-1)] : records;
        for (const record of sample) {
          const target = await record.getTarget();
          if (!target || !(await target.matches('[x-itemx2-drawer="owner"], [x-itemx2-drawer="owner"] *')))
            return scheduleHostDomSync();
        }
        if (!sample.length) scheduleHostDomSync();
      } catch (error) {
        debugRecord('host observer classify', error?.message || String(error));
        scheduleHostDomSync();
      }
    });
    if (!hostObserver?.observe) throw new Error('Mutation observer unavailable');
    await hostObserver.observe(body, { childList: true, subtree: true });
    armRemountWatchdog();
  } catch (error) {
    try {
      await hostObserver?.disconnect();
    } catch {}
    hostObserver = null;
    armRemountWatchdog();
    debugRecord('host observer install', error?.message || String(error));
  }
}

export function invalidateHostSettingsVisibility() {
  hostSettingsCache.at = 0;
}

export async function hostPluginSettingsVisible() {
  if (!mainDoc() || uiState.allowDrawerOverSettings) return false;
  const now = Date.now();
  if (now - hostSettingsCache.at < 750) return hostSettingsCache.visible;
  try {
    const safeTargets = await mainDoc().querySelectorAll('button,[role="button"]');
    const targets = await host().unwarpSafeArray(safeTargets);
    for (const target of targets.slice(0, 96)) {
      const text = String((await target.textContent()) || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text.includes(t('runtime.009'))) continue;
      const rect = await target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        hostSettingsCache = { at: now, visible: true };
        return true;
      }
    }
  } catch (error) {
    fail('host settings visibility', error);
  }
  hostSettingsCache = { at: now, visible: false };
  return false;
}

export async function syncHostSettingsVisibility() {
  if (!uiState.rootDrawer) return;
  const visible = await hostPluginSettingsVisible();
  if (Boolean(workQueue.revision('host-settings')) === visible) return;
  workQueue.remember('host-settings', visible);
  try {
    if (visible) await uiState.rootDrawer.addClass('x-risu-itemx2-host-settings');
    else await uiState.rootDrawer.removeClass('x-risu-itemx2-host-settings');
  } catch (error) {
    fail('host settings badge visibility', error);
  }
}

export async function setRootOpen(open) {
  if (uiState.panelOpen) {
    if (!open) {
      uiState.rootOpen = false;
      await closeInventory();
    }
    return;
  }
  if (!uiState.rootDrawer) return false;
  try {
    if (!(await uiState.rootDrawer.getParent())) {
      uiState.rootOpen = false;
      return false;
    }
    if (open) {
      await uiState.rootDrawer.addClass('x-risu-itemx2-is-open');
      await syncBadgeDelta({ seen: true });
    } else {
      await uiState.rootDrawer.removeClass('x-risu-itemx2-is-open');
      uiState.rootOpen = false;
      // A pending yes / no question does not survive closing the drawer.
      uiState.cleanupArmed = false;
      uiState.storageCleanupArmed = false;
      uiState.storageCleanupArmed = false;
      uiState.allowDrawerOverSettings = false;
      invalidateHostSettingsVisibility();
      await syncHostSettingsVisibility();
    }
    uiState.rootOpen = Boolean(open);
    return true;
  } catch {
    return false;
  }
}

export async function resetRuntimeForContext(active) {
  const nextKey = active?.key || '';
  if (activeContextKey() === nextKey) return false;
  setActiveContextKey(nextKey);
  resetPortraitContext();
  uiState.historyView = { open: false, key: nextKey, domain: 'item', filter: 'recent', selected: null, page: 0 };
  clearEventBursts();
  armRemountWatchdog();
  uiState.rootItemPage = 0;
  forgetDetailBodies();
  invalidateHostSettingsVisibility();
  invalidateLoaded();
  clearMarkerHtmlCache();
  detailHtmlCache.clear();
  workQueue.forget('catch-up');
  workQueue.forget('aux-settle');
  workQueue.remember('lorebook', '');
  uiState.cleanupArmed = false;

  workQueue.clearTimer('legacyCommitTimer');
  endOutputWindow();
  outputDeferred = false;
  await resetScrollEffects();
  forgetBodyEffectOwner();
  setLatestKeys([]);
  await removeRootDrawer();
  return true;
}

// Host sync deferred by the output window runs once when the window closes.
let outputDeferred = false;

// Indexes only: two scalar bridge reads instead of a character and chat
// snapshot. Any doubt counts as a move so the full sync runs as before.
async function contextMoved() {
  const loaded = cachedLoaded();
  if (!loaded || loaded.key !== activeContextKey()) return true;
  try {
    const [characterIndex, chatIndex] = await Promise.all([
      host().getCurrentCharacterIndex(),
      host().getCurrentChatIndex()
    ]);
    return characterIndex !== loaded.characterIndex || chatIndex !== loaded.chatIndex;
  } catch {
    return true;
  }
}

// While a response streams into the active chat, drawer and host sync wait
// for the output window to close. A chat switch is never deferred.
async function deferForOutput() {
  if (!outputActive()) return false;
  if (await contextMoved()) {
    endOutputWindow();
    return false;
  }
  outputDeferred = true;
  return true;
}

export function flushDeferredOutputSync() {
  if (!outputDeferred || isUnloading()) return;
  outputDeferred = false;
  scheduleHostDomSync(180);
}

export async function ensureRootInventory() {
  if (isUnloading() || scrollActive()) return;
  if (await deferForOutput()) return;
  return ensureRootInventoryNow();
}

export async function ensureRootInventoryNow() {
  if (uiState.backupOpen) return;
  if (scrollActive()) return;
  workQueue.remember('remount', 'checked');
  const active = await context();
  const contextChanged = await resetRuntimeForContext(active);
  if (!active) {
    setStatus(t('runtime.004'));
    return;
  }
  const cached = cachedLoaded();
  const replayChanged =
    !contextChanged && cached?.key === active.key && cached.replayFingerprint !== replayFingerprint(active.chat);

  if (!contextChanged && (auxActive() > 0 || workQueue.recent('host-settling', 1200) === active.key)) return;

  try {
    if (!hookState('output') || !hookState('display') || !hookState('before') || !hookState('after'))
      await installPipelineHooks();
    if (contextChanged) {
      if (!mainDoc() && !(await installMainStyle())) return;
      const loaded = await rebuildCurrent();
      if (loaded) await openRootInventory({ open: false, loaded });
      void dispatch('update', checkForUpdate);
      return;
    }
    if (!mainDoc() && !(await installMainStyle())) return;
    let drawerAttached = false;
    if (uiState.rootDrawer) {
      try {
        drawerAttached = Boolean(await uiState.rootDrawer.getParent());
      } catch {
        uiState.rootDrawer = null;
      }
    }
    if (!drawerAttached) {
      const safeMounted = await mainDoc().querySelectorAll('[x-itemx2-drawer="owner"]');
      const mounted = await host().unwarpSafeArray(safeMounted);
      if (mounted.length === 1) {
        uiState.rootDrawer = mounted[0];
        uiState.rootOpen = Boolean(await uiState.rootDrawer.matches('.x-risu-itemx2-is-open'));
        await installRootClickRouter(uiState.rootDrawer);
      } else {
        await removeRootClickRouter();
        uiState.rootDrawer = null;
        await openRootInventory({ open: false });
        return;
      }
    }
    await ensureMainStyleAttached();
    if (replayChanged) {
      const loaded = await rebuildCurrent();
      if (loaded) {
        let open = false;
        try {
          open = Boolean(await uiState.rootDrawer?.matches('.x-risu-itemx2-is-open'));
        } catch {}
        await openRootInventory({ open, loaded, tab: uiState.activeRootTab });
      }
    }
  } catch (error) {
    fail('root remount', error);
  }
}

export function skillSummaryHtml(skill, rarityMode = 'world') {
  const knownMastery = skill.mastery != null && Number.isFinite(Number(skill.mastery));
  const filled = knownMastery ? Math.max(0, Math.min(5, Math.ceil(Number(skill.mastery) / 20))) : 0;
  const levelLabel = skill.level == null ? t('ui-panel.125') : `Lv.${Number(skill.level)}`;
  const masteryLabel = knownMastery ? t('ui-panel.124', Number(skill.mastery)) : t('ui-panel.123');
  return `${codexListFx('skill', skillFxClasses(skill, rarityMode))}<span class="itemx2-codex-glyph">${Core.esc(skillEmoji(skill))}</span><span class="itemx2-codex-copy"><strong>${Core.esc(skill.name)}</strong><small>${Core.esc(skill.rank)} · ${levelLabel} · ${masteryLabel}</small><span class="itemx2-codex-tags"><i>✨ ${Core.esc(skill.type)}</i><i>${Core.esc(skill.status)}</i>${skill.affinity ? `<i>${Core.esc(skill.affinity)}</i>` : ''}</span></span><span class="itemx2-skill-meta"><small>${t('presentation.033')}</small><b>${Core.esc(skill.cost || t('ui-settings.150'))}</b><small>${t('presentation.031')}</small><b>${Core.esc(skill.cooldown || t('ui-settings.150'))}</b></span><span class="itemx2-mastery">${Array.from({ length: 5 }, (_, index) => `<i class="${index < filled ? 'on' : ''}"></i>`).join('')}</span>`;
}

export function skillPageHtml(skill, back, rarityMode = 'world') {
  const knownMastery = skill.mastery != null && Number.isFinite(Number(skill.mastery));
  const mastery = knownMastery ? Math.max(0, Math.min(10, Math.ceil(Number(skill.mastery) / 10))) : 0;
  const levelLabel = skill.level == null ? t('presentation.009') : `Lv.${Number(skill.level)}`;
  const masteryLabel = knownMastery ? `${Number(skill.mastery)}%` : t('presentation.009');
  const effects =
    (skill.effects || []).map((one) => `<i>${Core.esc(one)}</i>`).join('') || `<i>${t('ui-settings.059')}</i>`;
  const affinity = skillTheme(skill),
    tier = skillRankTier(skill.rank, rarityMode);
  const fx = Renderer.renderSkillFx({ ...skill, affinity }, tier, effectsMotion());
  const vars = Renderer.itemVars({ id: skill.id, name: skill.name, theme: 'arcane', rarity: tier, affinity });
  return `<div class="itemx-codex-page itemx2-codex-page">${back}<section class="itemx-codex-hero itemx-skill-hero craft-arcane ${skillFxClasses(skill, rarityMode)}" style="${vars}">${fx}<span class="itemx-codex-hero-glyph">${Core.esc(skillEmoji(skill))}</span><span class="itemx-codex-hero-copy"><small>✨ ARCANE SKILL RECORD</small><strong>${Core.esc(skill.name)}</strong><span>${Core.esc(skill.rank)} · ${Core.esc(skill.school || t('presentation.011'))} · ${Core.esc(skill.status)}</span></span></section><div class="itemx-codex-stat-grid"><span class="itemx-codex-stat"><small>LEVEL</small><strong>${levelLabel}</strong></span><span class="itemx-codex-stat"><small>TYPE / TARGET</small><strong>${Core.esc(skill.type || t('presentation.011'))} · ${Core.esc(skill.target || t('presentation.009'))}</strong></span><span class="itemx-codex-stat"><small>COST</small><strong>${Core.esc(skill.cost || t('ui-settings.150'))}</strong></span><span class="itemx-codex-stat"><small>COOLDOWN</small><strong>${Core.esc(skill.cooldown || t('ui-settings.150'))}</strong></span></div><section class="itemx-codex-section"><h4>${t('ui-panel.109.1')} ${masteryLabel}</h4><span class="itemx-codex-mastery">${Array.from({ length: 10 }, (_, index) => `<i class="${index < mastery ? 'on' : ''}"></i>`).join('')}</span></section>${skill.description ? `<section class="itemx-codex-section"><h4>${t('ui-panel.115.1')}</h4><p>${Core.esc(skill.description)}</p></section>` : ''}<section class="itemx-codex-section"><h4>${t('ui-panel.109.2')}</h4><span class="itemx-codex-chip-row">${effects}</span></section><section class="itemx-codex-section"><h4>${t('ui-panel.109.3')}</h4><p>${Core.esc(skill.growth || t('ui-settings.059'))}</p><small>ID · ${Core.esc(skill.id)}</small></section>${detailAnnotations('skill', skill)}</div>`;
}

export function monsterSummaryHtml(monster, portrait = '') {
  const visual = portrait
    ? `<img src="${Core.esc(portrait)}" alt="">`
    : `<span class="itemx2-codex-glyph">${Core.esc(encounterEmoji(monster))}</span>`;
  return `${codexListFx('encounter', encounterFxClasses(monster))}${visual}<span class="itemx2-codex-copy"><strong>${Core.esc(monster.name)}</strong><small>${Core.esc(monster.kind)} ${t('ui-panel.107.1')} ${Core.esc(monster.threat)} · ${Core.esc(monster.status)}</small><span class="itemx2-codex-tags"><i>⚔️ ${Core.esc(monster.relation)}</i>${(
    monster.weaknesses || []
  )
    .slice(0, 2)
    .map((one) => `<i>${t('ui-panel.108.1')} ${Core.esc(one)}</i>`)
    .join('')}</span></span><span class="itemx2-codex-glyph">${monster.active ? '⚔️' : '📖'}</span>`;
}

export function monsterPageHtml(monster, portrait, back) {
  const visual = portrait
    ? `<img class="itemx-monster-portrait" src="${Core.esc(portrait)}" alt="">`
    : `<span class="itemx-codex-hero-glyph">${Core.esc(encounterEmoji(monster))}</span>`;
  const chips = (label, values, fallback) =>
    `<section class="itemx-codex-section"><h4>${label}</h4><span class="itemx-codex-chip-row">${(values || []).map((one) => `<i>${Core.esc(one)}</i>`).join('') || `<i>${fallback}</i>`}</span></section>`;
  const outcomeLabels = {
    ended: t('ui-panel.106'),
    escaped: t('presentation.022'),
    defeated: t('ui-panel.104'),
    dead: t('presentation.020'),
    unknown: t('ui-panel.100')
  };
  const outcomeStatus = themeText(monster.outcomeStatus || monster.status);
  const outcome = monster.outcome
    ? `<section class="itemx-codex-section itemx2-encounter-outcome"><span class="itemx2-encounter-outcome-head"><h4>${t('ui-panel.099.1')}</h4><i>${Core.esc(outcomeLabels[outcomeStatus] || t('ui-panel.100'))}${monster.outcomeEncounter ? t('ui-panel.101', Number(monster.outcomeEncounter)) : ''}</i></span><p>${Core.esc(monster.outcome)}</p></section>`
    : '';
  const lore = monster._lore
    ? `<section class="itemx-codex-section"><small>${t('ui-panel.098.1')}</small></section>`
    : '';
  return `<div class="itemx-codex-page itemx2-codex-page">${back}<section class="itemx-codex-hero itemx-monster-hero ${encounterFxClasses(monster)}">${codexHeroFx('encounter')}<b class="itemx-threat-banner">⚠️ THREAT · ${Core.esc(monster.threat || t('presentation.009'))}</b>${visual}<span class="itemx-codex-hero-copy"><small>⚔️ ENCOUNTER ARCHIVE</small><strong>${Core.esc(monster.name)}</strong><span>${Core.esc(monster.kind || t('presentation.011'))} · ${Core.esc(monster.relation)} · ${Core.esc(monster.status)}</span></span></section><div class="itemx-codex-stat-grid"><span class="itemx-codex-stat"><small>ENCOUNTERS</small><strong>⚔️ ${Number(monster.encounterCount) || 1}${t('ui-panel.084.1')}</strong></span><span class="itemx-codex-stat"><small>COMBAT STATE</small><strong>${monster.active ? t('ui-panel.088') : t('ui-panel.087')}</strong></span></div>${outcome}${monster.description ? `<section class="itemx-codex-section"><h4>${t('ui-panel.089.1')}</h4><p>${Core.esc(monster.description)}</p></section>` : ''}${chips(t('ui-panel.091'), monster.aliases, t('ui-settings.150'))}${chips(t('ui-panel.093'), monster.weaknesses, t('presentation.009'))}${chips(t('ui-panel.095'), monster.resistances, t('presentation.009'))}${chips(t('ui-panel.097'), monster.moves, t('presentation.009'))}${lore}<section class="itemx-codex-section"><small>ID · ${Core.esc(monster.id)}</small></section>${detailAnnotations('monster', monster)}</div>`;
}

export const unwrapCodexPage = (html) =>
  String(html || '')
    .replace(/^<div class="itemx-codex-page itemx2-codex-page">/, '')
    .replace(/<\/div>$/, '');

export const portraitRevision = (portrait) => {
  const source = String(portrait || '');
  if (!source) return 'none';
  const sample = source.length <= 4096 ? source : `${source.slice(0, 2048)}${source.slice(-2048)}`;
  return `${source.length}:${Core.fnv1a(sample)}`;
};

export function codexDetailCacheKey(domain, entity, portrait = '', rarityMode = 'world') {
  const record = presentationRecord(domain, entity?.id);
  const fingerprint = Core.fnv1a(JSON.stringify([entity || {}, record.previous, record.review, effectsMotion()]));
  return domain === 'skill'
    ? `skill:${entity?.id || ''}:${fingerprint}:${rarityMode}`
    : `monster:${entity?.id || ''}:${fingerprint}:${portraitRevision(portrait)}`;
}

export function rootCodexDetailHtml(domain, entity, portrait = '', rarityMode = 'world') {
  const key = codexDetailCacheKey(domain, entity, portrait, rarityMode);
  const cached = detailHtmlCache.get(key);
  if (cached !== undefined) return cached;
  const back =
    domain === 'skill'
      ? `<label class="itemx-codex-back" for="itemx2-skill-none">${t('ui-panel.083.1')}</label>`
      : `<label class="itemx-codex-back" for="itemx2-monster-none">${t('ui-panel.082.1')}</label>`;
  const html = unwrapCodexPage(
    domain === 'skill' ? skillPageHtml(entity, back, rarityMode) : monsterPageHtml(entity, portrait, back)
  );
  detailHtmlCache.set(key, html);
  return html;
}

// Owned-item gains and losses in the latest response, shown on the side badge
// until the drawer is opened.
export function latestItemDelta() {
  const items = new Map();
  for (const key of currentLatestKeys()) {
    const payload = anchorPayload(key);
    if (!payload || payload.domain !== 'item') continue;
    const view = payload?.view;
    if (!view?.id || payload.error) continue;
    const seen = items.get(view.id);
    const previous = payload.previous;
    // Older records carry no possession in `previous`; an existing entry then counts as already held.
    const was = !previous ? false : previous.possession != null ? previous.possession === 'owned' : true;
    items.set(view.id, { was: seen ? seen.was : was, now: view.possession === 'owned' });
  }
  let gained = 0,
    lost = 0;
  for (const { was, now } of items.values()) {
    if (now && !was) gained += 1;
    else if (was && !now) lost += 1;
  }
  return { gained, lost, signature: [...currentLatestKeys()].sort().join('|') };
}

export let badgeDeltaDrawn = null;

export function badgeDeltaHtml() {
  const { gained, lost, signature } = latestItemDelta();
  if ((!gained && !lost) || uiState.badgeDeltaSeen === signature) return '<b class="itemx2-badge-word">ITEMX</b>';
  return `${gained ? `<b class="itemx2-badge-gain"><small>${t('ui-panel.badge-gain')}</small>+${gained}</b>` : ''}${lost ? `<b class="itemx2-badge-loss"><small>${t('ui-panel.badge-loss')}</small>−${lost}</b>` : ''}`;
}

export async function syncBadgeDelta({ seen = false } = {}) {
  if (seen) uiState.badgeDeltaSeen = latestItemDelta().signature;
  if (!mainDoc() || !uiState.rootDrawer) return;
  const html = badgeDeltaHtml();
  if (html === badgeDeltaDrawn) return;
  try {
    const mid = await mainDoc().querySelector('.x-risu-itemx2-badge-mid');
    if (mid) await mid.setInnerHTML(html);
    badgeDeltaDrawn = html;
  } catch (error) {
    debugRecord('badge delta', error?.message || String(error));
  }
}

export function rootBadgeHtml(loaded = null) {
  const owned = loaded?.snapshot ? itemsOf(loaded.snapshot).filter((item) => item.possession === 'owned').length : null;
  const update = updateState().available
    ? `<span class="itemx2-update-indicator" x-itemx2-update="${Core.esc(updateState().latest)}" aria-label="${t('ui-panel.update-available')}">↑</span>`
    : '';
  return `<div class="itemx2-native-badge" x-itemx2-badge="launcher" aria-label="ITEMX"><span class="itemx2-badge-seal"><span class="itemx2-badge-emoji" aria-hidden="true">📦</span></span><span class="itemx2-badge-mid">${badgeDeltaHtml()}</span><span class="itemx2-badge-foot">${owned == null ? '' : `<b>${owned}</b><small>${t('ui-panel.051')}</small>`}</span>${update}</div><div class="itemx2-aux-status ${auxRunning() ? 'itemx2-aux-status-on itemx2-aux-status-running' : ''}" aria-live="polite"><i></i><span class="itemx2-aux-status-label">${Core.esc(auxWorkingLabel())}</span><button class="itemx2-aux-cancel" type="button" aria-label="${t('aux.cancel-label')}">${t('aux.cancel')}</button></div>`;
}

export const updateLabelHtml = () =>
  updateState().available
    ? `<span class="itemx2-update-label" x-itemx2-update="${Core.esc(updateState().latest)}">UPDATE</span>`
    : '';

// The power toggle lives here rather than in settings: it is per bot, and a
// bot that does not want an item codex wants it off from the first message.
// Leaving it on costs about 2,900 tokens of protocol on every request.
export function panelMenuHtml(native = true, enabled = true) {
  return `<div class="itemx2-panel-actions"><button class="itemx-ph-btn itemx2-sw-power itemx2-setting-toggle${enabled ? ' itemx2-power-on' : ''}" type="button" role="switch" aria-checked="${enabled ? 'true' : 'false'}" aria-label="${t('ui-panel.power')}" title="${t('ui-panel.power')}"></button><label class="itemx-ph-btn itemx2-search-open" for="itemx2-search-toggle" role="button" aria-label="${t('ui-panel.054.3')}" title="${t('ui-panel.054.3')}">🔍</label><button class="itemx-ph-btn itemx2-history-open" type="button" aria-label="${t('ui-panel.history-open')}" title="${t('ui-panel.history-open')}">${t('ui-panel.058.1')}</button><button class="itemx-ph-btn ${native ? 'itemx2-root-close' : ''}" type="button" aria-label="${t('ui-settings.138.2')}" title="${t('ui-settings.138.2')}">✕</button></div>`;
}

export function historyDomain(tab) {
  return tab === 'skills' ? 'skill' : tab === 'bestiary' ? 'monster' : 'item';
}

export function selectHistoryRows(loaded) {
  const view = uiState.historyView;
  const rows = EntityHistory.entries(loaded, view.domain).filter((row) => row.closed);
  const selected = rows.find((row) => row.entity.id === view.selected);
  const visible = rows.filter((row) =>
    view.filter === 'kept'
      ? row.kept
      : view.filter === 'archived'
        ? row.archived
        : !row.kept &&
          !row.archived &&
          (view.filter === 'consume' ? row.automatic : view.filter === 'loss' ? !row.automatic : true)
  );
  const pages = Math.max(1, Math.ceil(visible.length / 16));
  view.page = Math.max(0, Math.min(pages - 1, view.page));
  uiState.historyRows = selected ? [selected] : visible.slice(view.page * 16, view.page * 16 + 16);
  return { pages, selected, rows: uiState.historyRows };
}

export async function prepareHistoryPortraits(loaded) {
  const view = uiState.historyView;
  if (!view.open || view.key !== loaded.key || view.domain !== 'monster') return;
  const { rows, selected } = selectHistoryRows(loaded);
  if (!rows.length) return;
  const signature = `${view.key}:${view.domain}:${view.selected || ''}:${view.filter}:${view.page}`;
  const monsters = {
    order: rows.map((row) => row.entity.id),
    entries: Object.fromEntries(rows.map((row) => [row.entity.id, row.entity]))
  };
  const portraits = await loadCodexPortraits(loaded.character, loaded.chat, { monsters }, loaded, !selected);
  const now = uiState.historyView;
  if (!now.open || `${now.key}:${now.domain}:${now.selected || ''}:${now.filter}:${now.page}` !== signature) return;
  if (selected) loaded.portraits = { ...loaded.portraits, ...portraits };
  else loaded.historyThumbnails = portraits;
}

export function historyHtml(loaded) {
  const view = uiState.historyView;
  const { pages, selected } = selectHistoryRows(loaded);
  const prefs = EntityHistory.preferences(loaded.prefs);
  const filters = [
    ['recent', t('ui-panel.079')],
    ...(view.domain === 'item'
      ? [
          ['consume', t('presentation.033')],
          ['loss', t('ui-panel.077')]
        ]
      : []),
    ['kept', t('ui-panel.073')],
    ['archived', t('ui-panel.075')]
  ];
  const buttons = (row, index) =>
    `<div class="itemx2-history-actions"><button class="itemx2-history-keep-${index}" type="button">${row.kept ? t('ui-panel.074') : t('ui-panel.073')}</button>${!row.kept && !row.archived && row.cycle ? `<button class="itemx2-history-archive-${index}" type="button">${t('ui-panel.archive-now')}</button>` : ''}</div>`;
  const label = (row) =>
    row.kept
      ? t('ui-panel.071')
      : row.archived
        ? t('ui-panel.070')
        : row.automatic && row.remaining !== null
          ? t('ui-panel.069', row.remaining)
          : row.domain === 'item'
            ? t('ui-panel.068')
            : row.domain === 'skill'
              ? t('ui-panel.067')
              : t('ui-panel.066');
  const cards = uiState.historyRows
    .map(
      (row, index) =>
        `<section class="itemx2-history-row itemx2-history-row-${index}"><button class="itemx2-history-detail-${index}" type="button"><strong>${row.domain === 'monster' && loaded.historyThumbnails?.[row.entity.id] ? `<img src="${Core.esc(loaded.historyThumbnails[row.entity.id])}" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:6px;vertical-align:middle">` : Core.esc(row.domain === 'item' ? Core.resolveItemEmoji(row.entity) : row.entity.glyph || '📖')} ${Core.esc(row.entity.name)}</strong><small>${label(row)}</small></button>${buttons(row, index)}</section>`
    )
    .join('');
  const detail = selected
    ? `${buttons(selected, 0)}${
        selected.domain === 'item'
          ? itemDetailHtml(selected.entity)
          : unwrapCodexPage(
              selected.domain === 'skill'
                ? skillPageHtml(selected.entity, '', loaded.rarityMode)
                : monsterPageHtml(selected.entity, loaded.portraits?.[selected.entity.id] || '', '')
            )
      }`
    : '';
  return `<header class="itemx2-history-heading"><button class="itemx2-history-back" type="button">‹ ${selected ? t('ui-panel.060') : t('ui-panel.059')}</button><strong>${{ item: t('ui-panel.063'), skill: t('ui-settings.045'), monster: t('ui-panel.061') }[view.domain]} ${t('ui-panel.058.1')}</strong></header><nav class="itemx2-history-filters">${filters.map(([key, label]) => `<button class="itemx2-history-filter-${key} ${view.filter === key ? 'itemx2-history-filter-on' : ''}" type="button">${label}</button>`).join('')}</nav><div class="itemx2-history-policy"><span>${t('ui-panel.058.2')}</span><button class="itemx2-history-retention" type="button">${prefs.after ? t('ui-panel.064', prefs.after) : 'OFF'}</button><small>${t('ui-panel.058.3')}</small></div><div class="itemx2-history-list">${selected ? detail : cards || `<p>${t('ui-panel.065.1')}</p>`}</div>${!selected && pages > 1 ? `<footer class="itemx2-history-actions"><button class="itemx2-history-prev" type="button">‹</button><span>${view.page + 1} / ${pages}</span><button class="itemx2-history-next" type="button">›</button></footer>` : ''}`;
}

export async function historyAction(action, loaded) {
  const view = uiState.historyView;
  if (view.key !== loaded.key) return;
  if (action === 'back') {
    if (view.selected) view.selected = null;
    else view.open = false;
  } else if (action.startsWith('filter-')) {
    view.filter = action.slice(7);
    view.page = 0;
    view.selected = null;
  } else if (action === 'prev' || action === 'next') view.page += action === 'prev' ? -1 : 1;
  else if (action === 'retention')
    await saveHistoryPreference(loaded, (prefs) => {
      prefs.after = EntityHistory.LIMITS[(EntityHistory.LIMITS.indexOf(prefs.after) + 1) % EntityHistory.LIMITS.length];
    });
  else {
    const [operation, rawIndex] = action.split('-');
    const row = uiState.historyRows?.[Number(rawIndex)];
    if (!row) return;
    if (operation === 'detail') view.selected = row.entity.id;
    else if (operation === 'keep')
      await saveHistoryPreference(loaded, (prefs) => {
        if (prefs.keep[row.key] === true) delete prefs.keep[row.key];
        else {
          prefs.keep[row.key] = true;
          delete prefs.archived[row.key];
        }
      });
    else if (operation === 'archive' && row.cycle)
      await saveHistoryPreference(loaded, (prefs) => {
        if (!prefs.keep[row.key]) prefs.archived[row.key] = row.cycle;
      });
  }
  await drawRootHistory(loaded);
}

// Every drawer render calls this; skip the host round trips while no pane was ever mounted.
export let historyPaneMounted = false;
export async function drawRootHistory(loaded) {
  const wanted = uiState.historyView.open && uiState.historyView.key === loaded?.key;
  if (!wanted && !historyPaneMounted) return;
  await prepareHistoryPortraits(loaded);
  const body = await queryMainClass('itemx2-root-tab-body');
  if (!body) return;
  let pane = await queryMainClass('itemx2-history-pane');
  if (!uiState.historyView.open || uiState.historyView.key !== loaded.key) {
    await pane?.remove();
    await body.removeClass('x-risu-itemx2-history-opened');
    historyPaneMounted = false;
    return;
  }
  if (!pane) {
    pane = await panelDocument().createElement('section');
    await pane.addClass('x-risu-itemx2-history-pane');
    await body.appendChild(pane);
  }
  historyPaneMounted = true;
  await pane.setInnerHTML(historyHtml(loaded));
  await body.addClass('x-risu-itemx2-history-opened');
}

export async function routeHistoryControls(event) {
  if (await eventHitsMainClass(event, 'itemx2-history-open')) {
    const loaded = await cachedOrRebuildCurrent();
    if (!loaded) return true;
    uiState.historyView = {
      open: true,
      key: loaded.key,
      domain: historyDomain(uiState.activeRootTab),
      filter: 'recent',
      selected: null,
      page: 0
    };
    await drawRootHistory(loaded);
    return true;
  }
  if (!uiState.historyView.open) return false;
  const loaded = await cachedOrRebuildCurrent();
  if (!loaded) return true;
  const actions = [
    'back',
    'retention',
    'prev',
    'next',
    ...['recent', 'consume', 'loss', 'kept', 'archived'].map((key) => `filter-${key}`)
  ];
  for (const action of actions)
    if (await eventHitsMainClass(event, `itemx2-history-${action}`)) {
      await historyAction(action, loaded);
      return true;
    }
  if (uiState.historyView.selected) {
    for (const action of ['keep-0', 'archive-0'])
      if (await eventHitsMainClass(event, `itemx2-history-${action}`)) {
        await historyAction(action, loaded);
        return true;
      }
  } else
    for (let index = 0; index < (uiState.historyRows?.length || 0); index++) {
      if (!(await eventHitsMainClass(event, `itemx2-history-row-${index}`))) continue;
      for (const operation of ['keep', 'archive', 'detail'])
        if (await eventHitsMainClass(event, `itemx2-history-${operation}-${index}`)) {
          await historyAction(`${operation}-${index}`, loaded);
          return true;
        }
      break;
    }
  return true;
}

export function searchControlsHtml() {
  return `<!--ITEMX2-SEARCH-START--><div class="itemx2-search-controls"><div class="itemx2-search-query" contenteditable="true" role="textbox" aria-label="${t('ui-panel.054.1')}" data-placeholder="${t('ui-panel.054.2')}">${Core.esc(uiState.query)}</div><button class="itemx2-search-apply" type="button">${t('ui-panel.054.3')}</button><button class="itemx2-search-clear" type="button">${t('ui-panel.054.4')}</button></div><!--ITEMX2-SEARCH-END-->`;
}

export function rootInventoryParts(loaded, open = true, tab = 'inventory') {
  if (!open)
    return {
      html: `${rootBadgeHtml(loaded)}<div class="itemx2-root-layer"><section class="itemx-panel itemx2-root-panel" aria-label="ITEMX"><div class="itemx2-tab-loading itemx2-open-loading" role="status" aria-live="polite"><i></i><strong>${t('ui-panel.053.1')}</strong><small>${t('ui-panel.053.2')}</small></div></section></div>`
    };
  const all = itemsOf(loaded.snapshot)
    .filter((item) => tab === 'settings' || (!EntityHistory.terminal('item', item) && matches(item)))
    .slice(0, 60);
  const pageCount = Math.max(1, Math.ceil(all.length / ITEMX_ROOT_PAGE_SIZE));
  uiState.rootItemPage = Math.max(0, Math.min(pageCount - 1, uiState.rootItemPage));
  const pageStart = uiState.rootItemPage * ITEMX_ROOT_PAGE_SIZE;
  const inventoryPage = tab === 'inventory' ? all.slice(pageStart, pageStart + ITEMX_ROOT_PAGE_SIZE) : [];
  const skills = (loaded.codexSnapshot?.skills?.order || [])
    .map((id) => loaded.codexSnapshot.skills.entries[id])
    .filter(Boolean)
    .filter((entity) => !EntityHistory.terminal('skill', entity))
    .filter(matches)
    .slice(0, 60);
  const monsters = codexEntries(loaded, 'monster');
  const counts = {
    all: all.length,
    owned: all.filter((item) => item.possession === 'owned').length,
    equipped: all.filter((item) => item.location === 'equipped').length,
    observed: all.filter((item) => item.possession === 'observed').length,
    removed: all.filter((item) => item.possession === 'removed').length
  };
  const filters = [
    ['all', t('ui-panel.052')],
    ['owned', t('ui-panel.051')],
    ['equipped', t('presentation.046')],
    ['observed', t('ui-panel.049')]
  ];
  const controls = filters
    .map(
      ([key]) =>
        `<input class="itemx2-root-control itemx2-root-filter-${key}" id="itemx2-filter-${key}" name="itemx2-filter" type="radio" ${key === 'all' ? 'checked' : ''}>`
    )
    .join('');
  // CSS-only, like the tab radios: the header label flips this and the search
  // bar appears. No proxy round-trip, and the bar costs no height until asked.
  const searchToggle = `<input class="itemx2-root-control itemx2-search-toggle" id="itemx2-search-toggle" type="checkbox"${uiState.query ? ' checked' : ''}>`;
  const skillList =
    tab === 'skills'
      ? skills
          .map(
            (skill, index) =>
              `<div class="itemx2-codex-entry"><input class="itemx2-root-control itemx2-codex-entry-choice itemx2-skill-entry-choice" id="itemx2-skill-${index}" name="itemx2-skill-detail" type="radio"><label class="itemx2-codex-card itemx2-codex-summary itemx2-skill-card" for="itemx2-skill-${index}">${skillSummaryHtml(skill, loaded.rarityMode)}</label><div class="itemx-codex-page itemx2-codex-page itemx2-skill-detail itemx2-root-skill-detail-body-${index}"><span class="itemx2-codex-detail-index">${index}</span><span class="itemx2-detail-loading">${t('ui-panel.048.1')}</span></div></div>`
          )
          .join('') || `<div class="itemx2-codex-empty">${t('ui-panel.047.1')}</div>`
      : '';
  const monsterList =
    tab === 'bestiary'
      ? monsters
          .map((monster, index) => {
            const portrait = loaded.portraitThumbs?.[monster.id] || loaded.portraits?.[monster.id] || '';
            return `<div class="itemx2-codex-entry"><input class="itemx2-root-control itemx2-codex-entry-choice itemx2-monster-entry-choice" id="itemx2-monster-${index}" name="itemx2-monster-detail" type="radio"><label class="itemx2-codex-card itemx2-codex-summary itemx2-bestiary-card ${monster.active ? 'active' : ''}" for="itemx2-monster-${index}">${monsterSummaryHtml(monster, portrait)}</label><div class="itemx-codex-page itemx2-codex-page itemx2-monster-detail itemx2-root-monster-detail-body-${index}"><span class="itemx2-codex-detail-index">${index}</span><span class="itemx2-detail-loading">${t('ui-panel.048.1')}</span></div></div>`;
          })
          .join('') || `<div class="itemx2-codex-empty">${t('ui-panel.045.1')}</div>`
      : '';
  const list =
    tab === 'inventory'
      ? inventoryPage
          .map((item, index) => {
            const detailId = `itemx2-detail-${index}`;
            const tile = Renderer.renderTile(item)
              .replace(/^<button\b/, '<span')
              .replace(/<\/button>$/, '</span>');
            const classes = [
              item.possession === 'owned' && 'itemx2-match-owned',
              item.location === 'equipped' && 'itemx2-match-equipped',
              item.possession === 'observed' && 'itemx2-match-observed',
              item.possession === 'removed' && 'itemx2-match-removed'
            ]
              .filter(Boolean)
              .join(' ');
            return `<div class="itemx2-root-item ${classes}"><input class="itemx2-root-control itemx2-root-detail-choice" id="${detailId}" name="itemx2-detail" type="radio"><label class="itemx2-root-tile-label itemx2-root-tile-${index}" for="${detailId}">${tile}</label><div class="itemx2-root-detail itemx-body"><label class="itemx-back itemx2-root-back" for="itemx2-detail-none">${t('ui-panel.044.1')}</label><div class="itemx-detail itemx2-root-detail-body-${index}"><span class="itemx2-detail-loading">${t('ui-panel.048.1')}</span></div></div></div>`;
          })
          .join('') || `<div class="itemx2-root-empty">${t('ui-panel.043.1')}</div>`
      : '';
  const enabled = loaded.enabled === true;
  const skin = SETTINGS_SKINS.native;
  const positionChoices = tab === 'settings' ? settingsPositionChoices(skin) : '';
  const fontChoices = tab === 'settings' ? settingsFontChoices(loaded, skin) : '';
  // Only the settings tab shows this; building it on every tab scanned the whole chat for storage size.
  const settings =
    tab !== 'settings'
      ? ''
      : (() => {
          const domainControls = settingsDomainControls(loaded, skin);
          // Phase timings go above the log: they are what a stutter report needs. Only
          // with debug on, so the panel a reader normally sees is unchanged.
          const storageParts = settingsStorageParts(loaded);
          // A map of the screen beats six abbreviations: the slot sits where the badge will.
          const managerRows =
            tab === 'settings'
              ? all
                  .map(
                    (item, index) =>
                      `<div class="itemx2-manager-row itemx2-manager-row-${index}"><span class="itemx2-manager-name"><strong>${Core.esc(Core.resolveItemEmoji(item))} ${Core.esc(item.name)}</strong><small>${Core.esc(item.displayRarity || item.rarity)} · ${Core.esc(item.possession)} / ${Core.esc(item.location)}</small></span><span class="itemx2-manager-actions"><button class="itemx2-manager-reroll-${index}" type="button">${t('ui-panel.014')}</button><button class="itemx2-manager-remove itemx2-manager-remove-${index}" type="button" ${item.possession === 'removed' ? 'disabled' : ''}>${t('ui-panel.remove')}</button></span></div>`
                  )
                  .join('') || `<div class="itemx2-root-empty">${t('ui-panel.041.1')}</div>`
              : '';
          const manager = `<details class="itemx2-manager-fold"><summary>${t('ui-panel.040.1')} <small>${t('ui-panel.040.2')}</small></summary><div class="itemx2-manager-body"><label class="itemx2-manager-label">${t('ui-panel.040.3')}<div class="itemx2-manager-editor itemx2-manager-note" contenteditable="true" role="textbox" aria-label="${t('ui-panel.040.4')}"></div></label><div class="itemx2-manager-list">${managerRows}</div><div class="itemx2-manager-create"><label class="itemx2-manager-label">${t('ui-panel.040.5')}<div class="itemx2-manager-editor itemx2-manager-create-note" contenteditable="true" role="textbox" aria-label="${t('ui-panel.040.5')}"></div></label><button class="itemx2-root-setting-button itemx2-manager-create-button" type="button">${t('ui-panel.040.7')}</button></div></div></details>`;
          const connection = connectionSummary();
          const chips = [
            ['hook', connection.hook],
            ['dom', connection.dom],
            ['listener', connection.listener]
          ]
            .map(
              ([key, [label, tone]]) =>
                `<i class="itemx2-status-chip itemx2-status-chip-${tone} itemx2-connection-${key}">${label}</i>`
            )
            .join('');
          const debugPanel = `<details class="itemx2-manager-fold itemx2-debug-fold">${debugFoldInner(loaded)}</details>`;
          return settingsPanelHtml(loaded, skin, {
            connection,
            chips,
            domainControls,
            fontChoices,
            positionChoices,
            manager,
            debugPanel,
            ...storageParts
          });
        })();
  const pager =
    pageCount > 1
      ? `<span class="itemx2-root-pager"><button class="itemx2-root-page-prev" type="button" ${uiState.rootItemPage === 0 ? 'disabled' : ''}>‹</button><b>${uiState.rootItemPage + 1} / ${pageCount}</b><button class="itemx2-root-page-next" type="button" ${uiState.rootItemPage >= pageCount - 1 ? 'disabled' : ''}>›</button></span>`
      : '';
  const shownEnd = Math.min(all.length, pageStart + inventoryPage.length);
  const inventoryContent = `<div class="itemx2-root-inventory"><nav class="itemx-seg itemx2-root-filters">${filters.map(([key, label]) => `<label class="itemx-seg-i" for="itemx2-filter-${key}">${label} <span class="itemx-seg-n">${counts[key]}</span></label>`).join('')}</nav><div class="itemx-tools itemx2-root-tools"><span class="itemx-tool">${loaded.effectsLevel !== 'off' ? t('ui-panel.035') : t('ui-panel.034')}</span><span class="itemx-search">${t('ui-panel.033.1')}</span></div><div class="itemx-body"><div class="itemx-grid">${list}</div></div><footer class="itemx-pf"><span>${all.length ? `${pageStart + 1}-${shownEnd}` : '0'} / ${all.length}${t('ui-panel.033.2')}${itemsOf(loaded.snapshot).length > 60 ? t('ui-panel.036') : ''}</span>${pager}</footer></div>`;
  const skillsContent = `<div class="itemx2-root-skills itemx2-root-tab-active"><input class="itemx2-root-control" id="itemx2-skill-none" name="itemx2-skill-detail" type="radio" checked><div class="itemx2-codex-note">${t('ui-panel.032.1')}</div>${skillList}</div>`;
  const bestiaryContent = `<div class="itemx2-root-bestiary itemx2-root-tab-active"><input class="itemx2-root-control" id="itemx2-monster-none" name="itemx2-monster-detail" type="radio" checked><div class="itemx2-codex-note">${t('ui-panel.031.1')}</div>${monsterList}</div>`;
  const activeContent =
    tab === 'skills'
      ? skillsContent
      : tab === 'bestiary'
        ? bestiaryContent
        : tab === 'settings'
          ? settings
          : inventoryContent;
  const tabs = [
    ['inventory', t('ui-panel.030')],
    ['skills', t('ui-panel.029')],
    ['bestiary', t('ui-panel.028')],
    ['settings', t('ui-panel.027')]
  ]
    .map(
      ([key, label]) =>
        `<button class="itemx-main-tab itemx2-root-tab-${key} ${tab === key ? 'itemx-main-tab-on' : ''}" type="button">${label}</button>`
    )
    .join('');
  const header = headerStatusHtml(loaded, counts);
  const body = `${tab === 'settings' ? '' : searchControlsHtml()}${activeContent}`;
  return {
    header,
    nav: tabs,
    body,
    html: `${controls}${searchToggle}${rootBadgeHtml(loaded)}<div class="itemx2-root-layer"><section class="itemx-panel itemx2-root-panel" aria-label="ITEMX"><input class="itemx2-root-control" id="itemx2-detail-none" name="itemx2-detail" type="radio" checked><header class="itemx-ph"><span class="itemx-ph-text"><span class="itemx-ph-eyebrow">ITEMX · ${ITEMX_VERSION_LABEL}${updateLabelHtml()}</span><span class="itemx-ph-title">${Core.esc(loaded.character.name || t('ui-panel.023'))}</span><span class="itemx-ph-sub">${header}</span></span>${panelMenuHtml(true, enabled)}</header><nav class="itemx-main-tabs">${tabs}</nav><div class="itemx2-root-tab-body">${body}</div><div class="itemx2-feedback" role="status" aria-live="polite"></div></section></div>`
  };
}

export const rootInventoryHtml = (loaded, open = true, tab = 'inventory') => rootInventoryParts(loaded, open, tab).html;

// Owned, equipped and observed counts of the listed items, shown in the header.
function listedItemCounts(loaded, tab) {
  const listed = itemsOf(loaded.snapshot)
    .filter((item) => tab === 'settings' || (!EntityHistory.terminal('item', item) && matches(item)))
    .slice(0, 60);
  return {
    owned: listed.filter((item) => item.possession === 'owned').length,
    equipped: listed.filter((item) => item.location === 'equipped').length,
    observed: listed.filter((item) => item.possession === 'observed').length
  };
}

export function headerStatusHtml(loaded, counts = listedItemCounts(loaded, uiState.activeRootTab || 'settings')) {
  return `${loaded.enabled === true ? t('ui-panel.026', counts.owned, counts.equipped, counts.observed) : t('ui-panel.025')} · ${Core.esc(status())}`;
}

// The debug fold's content; the <details> element itself stays in place so an
// open fold stays open when this is patched.
export function debugFoldInner(loaded) {
  // Phase timings go above the log: they are what a stutter report needs. Only
  // with debug on, so the panel a reader normally sees is unchanged.
  const debugLog = loaded.debugEnabled
    ? `-- phase cost --\n${phaseReport()}\n\n${settingsDebugLog()}`
    : settingsDebugLog();
  const items = itemsOf(loaded.snapshot).slice(0, 60).length;
  const skills = (loaded.codexSnapshot?.skills?.order || [])
    .map((id) => loaded.codexSnapshot.skills.entries[id])
    .filter((entity) => entity && !EntityHistory.terminal('skill', entity) && matches(entity))
    .slice(0, 60).length;
  const monsters = codexEntries(loaded, 'monster').length;
  return `<summary>${t('ui-panel.037.1')} <small>${loaded.debugEnabled ? t('ui-panel.038') : 'OFF'}</small></summary><div class="itemx2-debug-body"><button class="itemx2-root-setting-button itemx2-setting-debug ${loaded.debugEnabled ? 'itemx2-setting-on' : ''}" type="button">${t('ui-panel.log')} ${loaded.debugEnabled ? 'ON' : 'OFF'}</button><div class="itemx2-debug-grid"><b>${t('ui-panel.037.3')}</b><span>${Core.esc(loaded.key)}</span><b>${t('ui-panel.037.4')}</b><span>${currentGeneration()}</span><b>${t('ui-panel.037.5')}</b><span>${Core.esc(loaded.snapshot.fingerprint || '-')} / ${Core.esc(loaded.codexSnapshot.fingerprint || '-')}</span><b>${t('ui-panel.037.6')}</b><span>${items} / ${skills} / ${monsters}</span><b>${t('ui-panel.037.7')}</b><span>${Core.esc(lastError('hook') || lastError('dom') || t('ui-settings.150'))}</span></div><pre class="itemx2-debug-log">${Core.esc(debugLog)}</pre><button class="itemx2-root-setting-button itemx2-setting-debug-clear" type="button">${t('ui-panel.037.8')}</button></div>`;
}

export async function hostSettingsCard(hook) {
  let element = await queryMainClass(hook);
  for (let depth = 0; element && depth < 6; depth += 1) {
    if (await element.matches('.x-risu-itemx2-root-setting-card,.itemx2-root-setting-card')) return element;
    element = await element.getParent();
  }
  return null;
}
export async function settingsLoaded() {
  const loaded = cachedLoaded() || (await cachedOrRebuildCurrent());
  if (loaded) Object.assign(loaded, await settingsFor(loaded.character));
  return loaded;
}
export async function patchRootHeader(loaded) {
  const element = await queryMainClass('itemx-ph-sub');
  if (element) await element.setInnerHTML(headerStatusHtml(loaded));
}
export async function patchDebugPanel() {
  const loaded = await settingsLoaded();
  if (!loaded) return false;
  const fold = await queryMainClass('itemx2-debug-fold');
  if (!fold) return openRootInventory({ open: true, tab: 'settings', loaded });
  // The <details> element stays, so an open fold stays open.
  await fold.setInnerHTML(debugFoldInner(loaded));
  await patchRootHeader(loaded);
  return true;
}

export async function updateRootRegions(regions) {
  if (!mainDoc() || !uiState.rootDrawer || regions.body == null) return false;
  const header = await mainDoc().querySelector('.x-risu-itemx-ph-sub');
  const nav = await mainDoc().querySelector('.x-risu-itemx-main-tabs');
  const body = await mainDoc().querySelector('.x-risu-itemx2-root-tab-body');
  if (!header || !nav || !body) return false;
  try {
    await header.setInnerHTML(regions.header);
    await nav.setInnerHTML(regions.nav);
    await body.setInnerHTML(regions.body);
    forgetDetailBodies();
    return true;
  } catch (error) {
    debugRecord('root region fallback', error?.message || String(error));
    return false;
  }
}

export const rootStateFingerprint = (loaded) =>
  [
    loaded.snapshot?.fingerprint,
    loaded.codexSnapshot?.fingerprint,
    Number(loaded.enabled),
    Number(loaded.itemsEnabled),
    Number(loaded.skillsEnabled),
    Number(loaded.encountersEnabled),
    Number(loaded.mainOutput),
    loaded.auxOutput,
    loaded.rarityMode,
    Number(loaded.moduleAssetsEnabled),
    Number(loaded.lorebookEncounterEnabled),
    Number(loaded.debugEnabled),
    JSON.stringify(EntityHistory.preferences(loaded.prefs)),
    loaded.turn || 0
  ].join(':');

export async function managerRowIndexAtY(count, clientY) {
  let low = 0,
    high = count - 1;
  while (low <= high) {
    const index = (low + high) >> 1;
    const row = await queryMainClass(`itemx2-manager-row-${index}`);
    if (!row) return -1;
    const rect = await row.getBoundingClientRect();
    if (clientY < rect.top) high = index - 1;
    else if (clientY > rect.bottom) low = index + 1;
    else return index;
  }
  return -1;
}

const inside = (rect, event) =>
  Boolean(rect) &&
  rect.width > 0 &&
  rect.height > 0 &&
  event.clientX >= rect.left &&
  event.clientX <= rect.right &&
  event.clientY >= rect.top &&
  event.clientY <= rect.bottom;

// Rectangles of the controls one click may hit, fetched together when the
// click arrives: one concurrent round of bridge calls instead of one sequential
// pair per control. Valid for that click only (the click itself can move
// things); classes outside the table are queried live.
let hitTable = null;
async function rectOf(className) {
  const element = await queryMainClass(className);
  return element ? element.getBoundingClientRect() : null;
}
export async function buildHitTable(classNames) {
  const unique = [...new Set(classNames)];
  const rects = await Promise.all(unique.map((name) => rectOf(name).catch(() => null)));
  return new Map(unique.map((name, index) => [name, rects[index]]));
}
const ROOT_TABS = ['inventory', 'skills', 'bestiary', 'settings'];
// The controls a click on the drawer can reach, given the open tab: the table
// is filtered by tab so the settings rows are measured only on that tab.
export function hitCandidates(tab = uiState.activeRootTab) {
  const actions = rootSettingActions();
  return [
    'itemx2-root-close',
    'itemx2-search-apply',
    'itemx2-search-clear',
    'itemx2-history-open',
    'itemx2-setting-backup',
    ...ROOT_TABS.map((name) => `itemx2-root-tab-${name}`),
    ...actions.filter((action) => action.header).map((action) => action.hook),
    ...(tab === 'inventory' ? ['itemx2-root-page-prev', 'itemx2-root-page-next', 'itemx2-repair-one'] : []),
    ...(tab === 'settings'
      ? ['itemx2-manager-fold', 'itemx2-manager-create-button', ...actions.map((action) => action.hook)]
      : [])
  ];
}

export async function eventHitsMainClass(event, className) {
  if (hitTable?.has(className)) return inside(hitTable.get(className), event);
  return inside(await rectOf(className), event);
}

const AUX_CANCEL_HOOKS = ['itemx2-aux-cancel', 'itemx2-setting-aux-run'];
export async function routeAuxCancel(event) {
  if (!auxRunning() || !panelDocument()) return false;
  for (const hook of AUX_CANCEL_HOOKS) {
    const node = await panelDocument().querySelector(`.x-risu-${hook}`);
    if (!node) continue;
    const rect = await node.getBoundingClientRect();
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      await cancelAux();
      return true;
    }
  }
  return false;
}

export async function installRootClickRouter(owner) {
  if (!owner || (uiState.rootClickBindings[0]?.owner === owner && uiState.rootClickBindings.length)) return;
  await removeRootClickRouter();
  const routeBadge = async (event) => {
    try {
      const badge = panelDocument() && (await panelDocument().querySelector('.x-risu-itemx2-native-badge'));
      if (!badge) return false;
      const rect = await badge.getBoundingClientRect();
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        return false;
      await setRootOpen(true);
      const loaded = await cachedOrRebuildCurrent();
      if (!loaded) return true;
      const cacheReady = freshLoaded() === loaded;
      if (
        Boolean(workQueue.revision('render')) &&
        cacheReady &&
        workQueue.revision('render') === rootStateFingerprint(loaded)
      )
        return true;
      await openRootInventory({ open: true, loaded, tab: uiState.activeRootTab });
      return true;
    } catch (error) {
      fail('native badge click', error);
      return true;
    }
  };
  const routeControls = async (event) => {
    if (!uiState.rootOpen) return;
    hitTable = await buildHitTable(hitCandidates());
    try {
      await routeControlsNow(event);
    } finally {
      hitTable = null;
    }
  };
  const routeControlsNow = async (event) => {
    try {
      {
        if (await eventHitsMainClass(event, 'itemx2-root-close')) {
          if (uiState.historyView.open && cachedLoaded()) {
            uiState.historyView.open = false;
            await drawRootHistory(cachedLoaded());
          }
          await setRootOpen(false);
          return;
        }
      }
      if (
        (await eventHitsMainClass(event, 'itemx2-search-apply')) ||
        (await eventHitsMainClass(event, 'itemx2-search-clear'))
      ) {
        const clear = await eventHitsMainClass(event, 'itemx2-search-clear');
        const input = await queryMainClass('itemx2-search-query');
        uiState.query = clear
          ? ''
          : String((await input?.textContent()) || '')
              .trim()
              .slice(0, 200);
        uiState.rootItemPage = 0;
        await openRootInventory({ open: true, tab: uiState.activeRootTab });
        return;
      }
      // Header actions are handled before tab and body controls.
      for (const action of rootSettingActions()) {
        if (!action.header) continue;
        if (!(await eventHitsMainClass(event, action.hook))) continue;
        await action.run();
        return;
      }
      if (await eventHitsMainClass(event, 'itemx2-history-open')) {
        await routeHistoryControls(event);
        return;
      }
      for (const [tab, label] of [
        ['inventory', t('ui-panel.023')],
        ['skills', t('ui-settings.045')],
        ['bestiary', t('ui-panel.021')],
        ['settings', t('ui-panel.020')]
      ]) {
        if (!(await eventHitsMainClass(event, `itemx2-root-tab-${tab}`))) continue;
        if (uiState.activeRootTab === tab && !uiState.historyView.open) return;
        uiState.historyView.open = false;

        {
          if (tab === 'inventory') uiState.rootItemPage = 0;
          const body = panelDocument() && (await panelDocument().querySelector('.x-risu-itemx2-root-tab-body'));
          if (body) {
            await body.removeClass('x-risu-itemx2-history-opened');
            forgetDetailBodies();
            await body.setInnerHTML(
              `<div class="itemx2-tab-loading" role="status" aria-live="polite"><i></i><strong>${label} ${t('ui-panel.019.1')}</strong><small>${t('ui-panel.019.2')}</small></div>`
            );
          }
          await delay(24);
          await openRootInventory({ open: true, tab });
        }
        return;
      }
      if (await routeHistoryControls(event)) return;
      if (await eventHitsMainClass(event, 'itemx2-setting-backup')) {
        try {
          await openBackupPanel();
        } catch (error) {
          await notifyUser(error.message, 'error');
        }
        return;
      }
      for (const [direction, className] of [
        [-1, 'itemx2-root-page-prev'],
        [1, 'itemx2-root-page-next']
      ]) {
        if (!(await eventHitsMainClass(event, className))) continue;

        const loaded = await cachedOrRebuildCurrent();
        if (!loaded) return;
        const pageCount = Math.max(
          1,
          Math.ceil(
            Math.min(60, itemsOf(loaded.snapshot).filter((item) => !EntityHistory.terminal('item', item)).length) /
              ITEMX_ROOT_PAGE_SIZE
          )
        );
        const nextPage = Math.max(0, Math.min(pageCount - 1, uiState.rootItemPage + direction));
        if (nextPage === uiState.rootItemPage) return;
        uiState.rootItemPage = nextPage;

        {
          const body = panelDocument() && (await panelDocument().querySelector('.x-risu-itemx2-root-tab-body'));
          forgetDetailBodies();
          if (body)
            await body.setInnerHTML(
              `<div class="itemx2-tab-loading" role="status" aria-live="polite"><i></i><strong>${t('ui-panel.018.1')}</strong><small>${t('ui-panel.018.2')}</small></div>`
            );
          await delay(24);
          await openRootInventory({ open: true, tab: 'inventory', loaded });
        }
        return;
      }
      if (uiState.activeRootTab === 'inventory') {
        const loaded = freshLoaded() || (await cachedOrRebuildCurrent());
        if (loaded && (await eventHitsMainClass(event, 'itemx2-repair-one'))) {
          const items = rootPageItems(loaded);
          for (let index = 0; index < items.length; index++) {
            if (!(await panelDocument().querySelector(`#itemx2-detail-${index}:checked`))) continue;
            try {
              const refreshed = await repairOneItem(loaded, items[index].id);
              const detail = await queryMainClass(`itemx2-root-detail-body-${index}`);
              const item = refreshed?.snapshot?.registry?.items?.[items[index].id];
              if (activeContextKey() === loaded.key && detail && item)
                await detail.setInnerHTML(itemDetailBodyHtml(item));
              forgetDetailBodies();
            } catch (error) {
              await notifyUser(error.message || String(error), 'error');
            }
            return;
          }
        }
        if (loaded && loaded.key === activeContextKey()) {
          // SafeElement listeners are document-level. While this async
          // callback awaits, the label's native radio action can already
          // hide the clicked tile, making its rectangle zero-sized. Yield
          // once, then use the settled :checked state as the authoritative
          // target before retaining coordinate hit-testing as a fallback.
          await delay(0);
          if (await routeEntityDelete(event, loaded, 'item')) return;
          if (await hydrateCheckedItemDetail(loaded)) return;
          const detailItems = rootPageItems(loaded);
          for (let index = 0; index < detailItems.length; index += 1) {
            const tile = await queryMainClass(`itemx2-root-tile-${index}`);
            if (!tile) continue;
            const rect = await tile.getBoundingClientRect();
            if (
              rect.width <= 0 ||
              rect.height <= 0 ||
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              continue;
            const detail = await queryMainClass(`itemx2-root-detail-body-${index}`);
            if (detail) await detail.setInnerHTML(itemDetailBodyHtml(detailItems[index]));
            forgetDetailBodies();
            return;
          }
        }
      }
      if (uiState.activeRootTab === 'skills' || uiState.activeRootTab === 'bestiary') {
        const loaded = freshLoaded() || (await cachedOrRebuildCurrent());
        if (loaded && loaded.key === activeContextKey()) {
          await delay(0);
          const domain = uiState.activeRootTab === 'skills' ? 'skill' : 'monster';
          if (await routeEntityDelete(event, loaded, domain)) return;
          if (await hydrateCheckedCodexDetail(domain, loaded)) return;
        }
        return;
      }
      if (uiState.activeRootTab !== 'settings') return;
      {
        if (await eventHitsMainClass(event, 'itemx2-manager-fold')) {
          const loaded = await cachedOrRebuildCurrent();
          if (loaded) {
            const managedItems = itemsOf(loaded.snapshot).slice(0, 60);
            const index = await managerRowIndexAtY(managedItems.length, event.clientY);
            if (index >= 0) {
              const target = managedItems[index];
              if (await eventHitsMainClass(event, `itemx2-manager-reroll-${index}`)) {
                const noteElement = await queryMainClass('itemx2-manager-note');
                const note = (await noteElement?.textContent())?.trim() || '';
                setStatus(note ? t('ui-panel.017') : t('aux.019'));
                try {
                  const itemEvent = await runItemModel('reroll', loaded, target, note);
                  await commitManualEvents(loaded, [itemEvent], note ? t('ui-panel.015') : t('ui-panel.014'));
                } catch (error) {
                  setStatus(t('ui-panel.013'));
                  await notifyUser(`ITEMX: ${error.message || error}`, 'error');
                }
                await openRootInventory({ open: true, tab: 'settings' });
                return;
              }
              if (await eventHitsMainClass(event, `itemx2-manager-remove-${index}`)) {
                if (target.possession === 'removed') return;
                if (!(await confirmUser(t('ui-panel.012', target.name)))) return;
                const itemEvent = {
                  kind: 'patch',
                  patch: {
                    id: target.id,
                    action: null,
                    op: 'remove',
                    fields: {},
                    quantity: null,
                    destination: '',
                    reason: 'manual_remove',
                    slot: null,
                    inputs: null,
                    outputs: null,
                    equip: null,
                    unequip: null
                  }
                };
                try {
                  await commitManualEvents(loaded, [itemEvent], t('ui-panel.011'));
                } catch (error) {
                  setStatus(t('ui-panel.010'));
                  await notifyUser(`ITEMX: ${error.message || error}`, 'error');
                }
                await openRootInventory({ open: true, tab: 'settings' });
                return;
              }
            }
            if (await eventHitsMainClass(event, 'itemx2-manager-create-button')) {
              const createNoteElement = await queryMainClass('itemx2-manager-create-note');
              const createNote = (await createNoteElement?.textContent())?.trim() || '';
              if (!createNote) {
                await notifyUser(t('ui-panel.009'), 'error');
                return;
              }
              setStatus(t('aux.020'));
              try {
                const itemEvent = await runItemModel('create', loaded, null, createNote);
                await commitManualEvents(loaded, [itemEvent], t('ui-panel.007'));
              } catch (error) {
                setStatus(t('ui-panel.006'));
                await notifyUser(`ITEMX: ${error.message || error}`, 'error');
              }
              await openRootInventory({ open: true, tab: 'settings' });
              return;
            }
          }
        }
      }
      for (const action of rootSettingActions()) {
        if (!(await eventHitsMainClass(event, action.hook))) continue;
        await action.run();
        return;
      }
    } catch (error) {
      fail('native setting click', error);
    }
  };
  const queued = entry(
    'ui-action',
    async (event) => {
      try {
        if (await routeBadge(event)) return;
        await routeControls(event);
      } catch (error) {
        fail('root click router', error);
      }
    },
    true
  );
  // Cancelling the auxiliary pass must not queue behind it: the pass holds the
  // commit lane for the whole model call. It is checked first, outside the queue.
  const id = await owner.addEventListener(
    'click',
    async (event) => {
      try {
        if (await routeAuxCancel(event)) return;
      } catch (error) {
        fail('aux cancel click', error);
      }
      return queued(event);
    },
    true
  );
  uiState.rootClickBindings = [{ owner, type: 'click', id, capture: true }];
}

export async function openRootInventory(options = {}) {
  if (uiState.panelOpen) {
    const loaded = options.loaded || (await cachedOrRebuildCurrent());
    if (loaded) await drawInventory(loaded, options.tab || uiState.activeRootTab);
    return;
  }
  return openRootInventoryNow(options);
}

export async function openRootInventoryNow({ open = true, tab = 'inventory', loaded: suppliedLoaded = null } = {}) {
  if (uiState.backupOpen) return;
  try {
    if (uiState.activeRootTab !== tab) uiState.historyView.open = false;
    uiState.panelOpen = false;
    try {
      await host().hideContainer();
    } catch {}
    const loaded = suppliedLoaded || (await cachedOrRebuildCurrent());
    if (!loaded) throw new Error('No active chat context');
    if (activeContextKey() && activeContextKey() !== loaded.key) return;
    loaded.enabled = await isEnabled(loaded.character);
    Object.assign(loaded, await settingsFor(loaded.character));
    // The list only needs 96px thumbnails; the detail view loads the full portrait on open.
    loaded.portraits = {};
    loaded.portraitThumbs =
      tab === 'bestiary' && loaded.encountersEnabled
        ? await loadCodexPortraits(loaded.character, loaded.chat, loaded.codexSnapshot, loaded, true)
        : {};
    const styled = await installMainStyle({ prompt: true });
    if (!styled || !mainDoc()) {
      setStatus(t('ui-panel.005'));
      await notifyUser(t('ui-panel.004'), 'error');
      return;
    }
    let root = uiState.rootDrawer,
      attached = false;
    if (root) {
      try {
        attached = Boolean(await root.getParent());
      } catch {
        root = null;
      }
    }
    if (!attached) {
      await removeRootDrawer();
      root = await mainDoc().createElement('div');
    }
    await root.setAttribute('x-itemx2-drawer', 'owner');
    await root.setClassName(
      `x-risu-itemx2-root-drawer x-risu-itemx2-pos-${badgePositionSetting()} x-risu-itemx2-font-${loaded.fontScale || 'small'}${open ? ' x-risu-itemx2-is-open' : ''}${loaded.effectsLevel !== 'off' ? '' : ' x-risu-itemx2-effects-off'}${SKIN_NAMES.includes(loaded.skin) ? ` x-risu-itemx2-skin-${loaded.skin}` : ''}${loaded.enabled ? '' : ' x-risu-itemx2-bot-off'}`
    );
    void syncPowerUi(loaded.enabled);
    if (open) uiState.badgeDeltaSeen = latestItemDelta().signature;
    const parts = rootInventoryParts(loaded, open, tab);
    const html = parts.html;
    const regionUpdated = attached && open && Boolean(workQueue.revision('render')) && (await updateRootRegions(parts));
    if (!regionUpdated) {
      await root.setInnerHTML(html);
      // Only a full drawer write repaints the badge; string-only renders must not claim it.
      badgeDeltaDrawn = badgeDeltaHtml();
      forgetDetailBodies();
    }
    if (!attached) {
      const body = await mainDoc().querySelector('body');
      if (!body) throw new Error('Main document body unavailable');
      if (activeContextKey() !== loaded.key) return;
      await body.appendChild(root);
      if (activeContextKey() !== loaded.key) {
        await root.remove();
        return;
      }
    }
    uiState.rootDrawer = root;
    uiState.rootOpen = Boolean(open);
    workQueue.remember('render', open ? rootStateFingerprint(loaded) : '');
    uiState.activeRootTab = tab;
    // Region updates retain the body element, including its classes. Reconcile
    // the closed state too, or a former history overlay hides the new tab.
    await drawRootHistory(loaded);
    await installRootClickRouter(root);
  } catch (error) {
    setStatus(t('ui-panel.001'));
    await removeRootDrawer();
    fail('openRootInventory', error);
  }
}

export function matches(item) {
  const q = uiState.query.trim().toLocaleLowerCase();
  return (
    !q ||
    [item.name, item.id, item.itemType, item.displayRarity, item.affinity, item.affinity2, item.school, item.kind].some(
      (value) =>
        String(value || '')
          .toLowerCase()
          .includes(q)
    )
  );
}

export async function drawInventory(loaded, tab = uiState.activeRootTab) {
  const root = document.querySelector('#itemx2-root');
  if (!root) return;
  uiState.activeRootTab = tab;
  uiState.rootOpen = true;
  root.className = `itemx2-root-drawer itemx2-frame itemx2-is-open itemx2-font-${loaded.fontScale || 'small'}${loaded.effectsLevel !== 'off' ? '' : ' itemx2-effects-off'}${SKIN_NAMES.includes(loaded.skin) ? ` itemx2-skin-${loaded.skin}` : ''}`;
  root.innerHTML = rootInventoryHtml(loaded, true, tab);
  await drawRootHistory(loaded);
  await installRootClickRouter(nativeElement(root));
}

export function reducedMotion() {
  return (
    typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export async function closeInventory({ immediate = false } = {}) {
  uiState.panelOpen = false;
  const panel = typeof document === 'undefined' ? null : document.querySelector('.itemx-panel');
  if (panel && !immediate && !reducedMotion()) {
    panel.classList.remove('itemx-plugin-panel-in');
    panel.classList.add('itemx-plugin-panel-out');
    await Promise.race([
      new Promise((resolve) => panel.addEventListener('animationend', resolve, { once: true })),
      delay(210)
    ]);
  }
  if (uiState.panelOpen) return;
  await host().hideContainer();
  uiState.allowDrawerOverSettings = false;
  invalidateHostSettingsVisibility();
  await syncHostSettingsVisibility();
}

export async function openInventory(tab = 'inventory') {
  if (tab === 'inventory') return openRootInventory();
  uiState.panelOpen = true;
  uiState.activeRootTab = tab;
  try {
    // The stock API has one container mode. The fallback panel is bounded by
    // its own stylesheet inside that fullscreen iframe.
    document.head.innerHTML = fallbackDocumentHead();
    document.body.innerHTML = '<div id="itemx2-root"></div>';
    const loaded = await rebuildCurrent();
    if (!loaded) throw new Error('No active chat context');
    loaded.enabled = await isEnabled(loaded.character);
    Object.assign(loaded, await settingsFor(loaded.character));
    await drawInventory(loaded, tab);
    await host().showContainer('fullscreen');
    const panel = document.querySelector('.itemx-panel');
    if (panel && uiState.panelOpen && !reducedMotion()) panel.classList.add('itemx-plugin-panel-in');
  } catch (error) {
    uiState.panelOpen = false;
    setStatus(t('ui-panel.001'));
    try {
      await host().hideContainer();
    } catch {}
    fail('openInventory', error);
  }
}

export async function syncRootFontScale(value) {
  const root = uiState.rootDrawer;
  if (!root) return;
  for (const scale of FONT_SCALES) {
    try {
      await root.removeClass(`x-risu-itemx2-font-${scale}`);
    } catch {}
  }
  try {
    await root.addClass(`x-risu-itemx2-font-${FONT_SCALES.includes(value) ? value : 'small'}`);
  } catch {}
}

// The host can rebuild its body and drop our drawer. With a mutation observer
// this is a slow safety net; without one it is how the drawer comes back.
export function armRemountWatchdog() {
  if (isUnloading()) return;
  const interval = hostObserver || !activeContextKey() ? 10000 : 1200;
  workQueue.clearTimer('remountTimer');
  workQueue.schedule(
    'remountTimer',
    () => {
      if (scrollActive()) return;
      if (!activeContextKey() || !hostObserver || workQueue.age('remount') >= 10000) return ensureRootInventory();
    },
    interval,
    true
  );
}
