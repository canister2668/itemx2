/* Composition and lifecycle. main.js wires the layers together (hook handlers,
 * upward events) and owns start, browser resume and unload; domain work lives
 * in the imported modules. */
import { endOutputWindow, setOutputWindowSink } from './activity.js';
import { context } from './chat-io.js';
import { ITEMX_PLUGIN_VERSION, ITEMX_UPDATE_CHECK_MS } from './config.js';
import { isUnloading, markUnloading, registeredUiParts, rememberUiPart } from './connection.js';
import { clearListeners, on } from './events.js';
import {
  configureHooks,
  installDisplayHooks,
  installPipelineHooks,
  refreshHookBindings,
  removeHooks
} from './hooks.js';
import { host } from './host.js';
import { t } from './i18n.js';
import { delay, dispatch, entry, fail, log, workQueue } from './kernel.js';
import { rebuildCurrent } from './ledger.js';
import {
  afterRequest,
  armCatchUpWatchdog,
  beforeRequest,
  catchUpLatestOutput,
  outputFallback,
  processHandler,
  scheduleCommittedOutputSync
} from './pipeline.js';
import { invalidateModuleAssets } from './portraits.js';
import { activeContextKey, cachedLoaded, invalidateLoaded, setActiveContextKey } from './session.js';
import { loadBadgePosition, settingsFor } from './settings.js';
import { setStatus } from './status.js';
import { syncAuxIndicator } from './ui/controls.js';
import {
  armRemountWatchdog,
  clearDetailHtmlCache,
  disconnectHostObserver,
  ensureRootInventory,
  flushDeferredOutputSync,
  installHostObserver,
  mountRootLoading,
  notifyUser,
  openRootInventory,
  removeRootDrawer,
  scheduleHostDomSync,
  syncBadgeDelta,
  syncRootFontScale,
  updateRootLoading
} from './ui/panel.js';
import {
  applyVisualSettings,
  armEventBursts,
  clearEventBursts,
  clearMarkerHtmlCache,
  commitEventBursts,
  displayHandler,
  forgetBodyEffectOwner,
  installBodyEffectGovernor,
  outputWindowChanged,
  removeBodyEffectGovernor,
  resetScrollEffects,
  syncMainEffectsState
} from './ui/presentation.js';
import { openSettingsFromRisuMenu, syncPowerUi, syncUpdateIndicator } from './ui/settings.js';
import { installMainStyle, removeMainStyle } from './ui/style.js';
import { uiState } from './ui/view-state.js';
import { checkForUpdate } from './update-check.js';

// Display and process are pure text transforms over in-memory state: they run
// directly, never behind queued work. Output and the request replacers use the
// queue's reentrant slot because they may land while a model call is pending.
const direct = (where, work) => async (content) => {
  try {
    return await work(content);
  } catch (error) {
    fail(where, error);
    return content;
  }
};
const hookHandlers = {
  process: direct('process', processHandler),
  output: entry('output', outputFallback, true),
  display: direct('display', displayHandler),
  before: entry('before-request', beforeRequest, true),
  after: entry('after-request', afterRequest, true),
  listener: (output) => {
    // The host calls this once the response is final: the output window closes.
    endOutputWindow();
    const loaded = cachedLoaded();
    if (
      output?.chat &&
      loaded?.key === activeContextKey() &&
      output.characterIndex === loaded.characterIndex &&
      output.chatIndex === loaded.chatIndex
    )
      commitEventBursts(output.chat);
    void scheduleCommittedOutputSync();
  }
};

// Lower layers announce; the UI follows.
function wireEvents() {
  on('settings', async ({ settings, patch }) => {
    applyVisualSettings(settings, patch);
    if (!patch) return;
    if ('effectsLevel' in patch || 'cardFx' in patch) clearDetailHtmlCache();
    if ('effectsLevel' in patch || 'skin' in patch) await syncMainEffectsState();
    if ('fontScale' in patch) await syncRootFontScale(settings.fontScale);
    if ('moduleAssetsEnabled' in patch) invalidateModuleAssets();
    if ('lorebookEncounterEnabled' in patch) workQueue.remember('lorebook', '');
    if (['itemsEnabled', 'skillsEnabled', 'encountersEnabled', 'auxOutput'].some((key) => key in patch)) {
      workQueue.forget('catch-up');
      workQueue.forget('aux-settle');
    }
    if ('enabled' in patch) {
      // The drawer's render fingerprint predates this change; the next open redraws.
      workQueue.remember('render', '');
      await syncPowerUi(settings.enabled);
    }
  });
  on('markers', () => syncBadgeDelta());
  on('markers-armed', (text) => armEventBursts(text));
  on('output-committed', (chat) => commitEventBursts(chat));
  on('chat-synced', async (loaded) => {
    if (loaded) commitEventBursts(loaded.chat);
    await ensureRootInventory();
  });
  on('data-reset', () => {
    workQueue.remember('render', '');
    clearMarkerHtmlCache();
    clearDetailHtmlCache();
  });
  on('aux', async ({ outcome }) => {
    await syncAuxIndicator();
    if (!outcome) return;
    workQueue.clearTimer('auxToastTimer');
    workQueue.schedule('auxToastTimer', () => void syncAuxIndicator(), 2600, false);
  });
  on('notify', ({ message, tone }) => notifyUser(message, tone));
  on('update', () => syncUpdateIndicator());
  on('hooks', () => {
    if (workQueue.hasTimer('catchUpTimer')) armCatchUpWatchdog();
  });
  on('main-document', async (doc) => {
    if (!doc) return forgetBodyEffectOwner();
    await installBodyEffectGovernor();
    await syncMainEffectsState();
    await installHostObserver();
  });
  on('scroll-idle', () => scheduleHostDomSync(180, { light: true }));
  on('output-idle', () => {
    flushDeferredOutputSync();
    workQueue.wake();
  });
}

// A backgrounded tab can come back with its host hook sets rebuilt and its
// main-document nodes replaced. Resume restores rendering and bindings only:
// regeneration belongs to real new turns.
let backgrounded = false;
const resumeBindings = [];

async function recoverAfterBrowserResume() {
  if (isUnloading()) return;
  workQueue.cancel((intent) => intent.kind === 'committed-output', false);
  endOutputWindow();
  try {
    await resetScrollEffects();
    await refreshHookBindings();
    invalidateLoaded();
    await installMainStyle();
    await rebuildCurrent();
    await ensureRootInventory();
    backgrounded = false;
  } catch (error) {
    fail('browser resume recovery', error);
  }
}

function queueBrowserResume() {
  if (isUnloading() || !backgrounded) return;
  workQueue.clearTimer('resumeTimer');
  workQueue.schedule('resumeTimer', () => recoverAfterBrowserResume(), 80, false);
}

function installBrowserResumeHandlers() {
  const bind = (target, type, handler) => {
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(type, handler);
    resumeBindings.push({ target, type, handler });
  };
  const background = () => {
    backgrounded = true;
  };
  const visible = () => {
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') queueBrowserResume();
  };
  bind(globalThis, 'pagehide', background);
  bind(globalThis, 'pageshow', visible);
  bind(globalThis, 'focus', visible);
  bind(typeof document === 'undefined' ? null : document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') background();
    else queueBrowserResume();
  });
}

function removeBrowserResumeHandlers() {
  for (const { target, type, handler } of resumeBindings.splice(0)) {
    try {
      target.removeEventListener(type, handler);
    } catch {}
  }
}

// The host gives unload callbacks one second before terminating the iframe and
// drops none of our hooks, UI parts or main-document nodes itself.
async function unload() {
  markUnloading();
  endOutputWindow();
  setOutputWindowSink(null);
  const quiet = (work) =>
    Promise.resolve()
      .then(work)
      .catch(() => {});
  removeBrowserResumeHandlers();
  clearEventBursts();
  uiState.panelOpen = false;
  await Promise.all([
    removeHooks(),
    ...registeredUiParts().map((id) => quiet(() => host().unregisterUIPart(id))),
    quiet(() => disconnectHostObserver()),
    quiet(() => removeMainStyle()),
    quiet(() => removeRootDrawer()),
    quiet(() => removeBodyEffectGovernor()),
    quiet(() => resetScrollEffects()),
    quiet(() => host().hideContainer())
  ]);
  await Promise.race([workQueue.close(), delay(250)]);
  clearListeners();
}

export async function start() {
  // Registered first: a failing or slow bootstrap must still be able to unload.
  await host().onUnload(unload);
  wireEvents();
  setOutputWindowSink(outputWindowChanged);
  configureHooks(hookHandlers);
  try {
    await loadBadgePosition();
    await dispatch('bootstrap', async () => {
      const setting = await host().registerSetting(
        t('runtime.009'),
        entry('settings', openSettingsFromRisuMenu),
        '💎',
        'html',
        'itemx2-current-bot'
      );
      if (setting?.id) rememberUiPart(setting.id);
      await installDisplayHooks();
      const initial = await context();
      let connected = false,
        styled = false;
      if (initial) {
        setActiveContextKey(initial.key);
        setStatus(t('runtime.008'));
        await settingsFor(initial.character);
        styled = await installMainStyle();
        if (styled) await mountRootLoading(t('runtime.007'));
        await updateRootLoading(t('runtime.006'));
        connected = await installPipelineHooks();
        await updateRootLoading(t('runtime.005'));
        await rebuildCurrent(initial);
        if (styled) await openRootInventory({ open: false });
        void dispatch('update', checkForUpdate);
      } else {
        setStatus(t('runtime.004'));
      }
      armRemountWatchdog();
      armCatchUpWatchdog();
      workQueue.schedule('updateTimer', () => void dispatch('update', checkForUpdate), ITEMX_UPDATE_CHECK_MS, true);
      if (initial)
        void dispatch('catch-up', catchUpLatestOutput).catch((error) => fail('initial output catch-up', error));
      installBrowserResumeHandlers();
      if (connected && styled) setStatus(t('runtime.003'));
      log(`v${ITEMX_PLUGIN_VERSION} ready`);
    });
  } catch (error) {
    setStatus(t('runtime.002'));
    await removeRootDrawer();
    await notifyUser(t('runtime.001', error.message || error), 'error');
    fail('bootstrap', error);
  }
}
