/* Bootstrap and lifecycle; domain implementations are assembled by build.mjs. */
(async () => {
  'use strict';
  const workQueue = ITEMXWorkQueue.create();
  const dispatch = (kind, work, unique = false, options = {}) =>
    workQueue.enqueue({
      kind,
      work,
      unique,
      ...options,
      reentrant: ['process', 'output', 'display', 'before-request', 'after-request', 'scroll'].includes(kind)
    });
  const entry =
    (kind, work, unique = false) =>
    (...args) =>
      dispatch(kind, () => work(...args), unique);
  // Reading a chat must observe the host, which runs outside our queue.
  // Keep immutable read provenance, never a cache of mutable host state.
  const chatReads = new WeakMap();
  const readChat = async (characterIndex, chatIndex, ...rest) => {
    const raw = await timed('host:readChat', () => Risuai.getChatFromIndex(characterIndex, chatIndex, ...rest));
    const original = JSON.stringify(raw);
    const chat = timedSync('storage:hydrate', () => ITEMXStorage.hydrate(raw));
    if (chat) chatReads.set(chat, { characterIndex, chatIndex, original });
    return chat;
  };
  const saveChat = async (characterIndex, chatIndex, chat, base = chat, { cleanup = false } = {}) => {
    workQueue.assertCurrent();
    const read = chatReads.get(base);
    if (!read || read.characterIndex !== characterIndex || read.chatIndex !== chatIndex)
      throw new Error('ITEMX write requires its original chat read');
    // Detach before the first await: persist intentionally shares message arrays.
    const detached = JSON.parse(JSON.stringify(chat));
    const persisted = cleanup ? detached : timedSync('storage:persist', () => ITEMXStorage.persist(detached));
    const latest = await timed('host:readChat', () => Risuai.getChatFromIndex(characterIndex, chatIndex));
    workQueue.assertCurrent();
    if (JSON.stringify(latest) !== read.original)
      throw new Error('ITEMX chat changed before saving; retry the operation');
    // Stock API has no atomic compare-and-set. This rejects observed conflicts;
    // the host still owns the interval between the final read and whole-chat set.
    return timed('host:writeChat', () => Risuai.setChatToIndex(characterIndex, chatIndex, persisted));
  };
  const stateOwners = ITEMXState.create();
  const { host: hostState, pipeline: pipelineState, aux: auxState, presentation: presentationState, portraits: portraitsState, storage: storageState, settings: settingsState, ui: uiState } = stateOwners;
  const ui = uiState.view;
  const log = (...args) => console.log('[ITEMX 2]', ...args);
  const debugRecord = (where, detail = '') => {
    if (!settingsState.debugEnabled) return;
    const text = typeof detail === 'string' ? detail : JSON.stringify(detail);
    settingsState.debugEntries.push({ at: Date.now(), where: String(where), detail: String(text || '').slice(0, 500) });
    if (settingsState.debugEntries.length > 30) settingsState.debugEntries.splice(0, settingsState.debugEntries.length - 30);
    console.log(`[ITEMX 2 · DEBUG] ${where}`, detail);
  };
  const flickerWatch = { on: false, raf: 0, last: 0, bound: [], lastResize: 0 };
  function startFlickerWatch() {
    if (flickerWatch.on || typeof window === 'undefined') return;
    flickerWatch.on = true;
    const vv = window.visualViewport || null;
    const size = () =>
      `${window.innerWidth}x${window.innerHeight}` + (vv ? ` visual=${Math.round(vv.width)}x${Math.round(vv.height)} off=${Math.round(vv.offsetTop)}` : '');
    const onResize = () => {
      const now = Date.now();
      if (now - flickerWatch.lastResize < 120) return;
      flickerWatch.lastResize = now;
      debugRecord('watch:resize', size());
    };
    const onVisible = () => debugRecord('watch:visibility', document.visibilityState);
    const bind = (target, type, handler) => { if (!target) return; target.addEventListener(type, handler); flickerWatch.bound.push([target, type, handler]); };
    bind(window, 'resize', onResize);
    bind(vv, 'resize', onResize);
    bind(vv, 'scroll', onResize);
    bind(document, 'visibilitychange', onVisible);
    debugRecord('watch:start', `${size()} dpr=${window.devicePixelRatio}`);
    // A frame gap far past the budget is what the eye reads as a flicker.
    flickerWatch.last = now();
    const tick = () => {
      if (!flickerWatch.on) return;
      const at = now(), gap = at - flickerWatch.last;
      flickerWatch.last = at;
      if (gap > 120) debugRecord('watch:stall', `${Math.round(gap)}ms ${size()}`);
      flickerWatch.raf = requestAnimationFrame(tick);
    };
    flickerWatch.raf = requestAnimationFrame(tick);
  }
  function stopFlickerWatch() {
    if (!flickerWatch.on) return;
    flickerWatch.on = false;
    if (flickerWatch.raf) cancelAnimationFrame(flickerWatch.raf);
    for (const [target, type, handler] of flickerWatch.bound) target.removeEventListener(type, handler);
    flickerWatch.bound = [];
  }

  // Phase timing, always on and cheap: a counter and a running total per phase.
  // The costs that matter here are host round-trips, which no benchmark outside
  // the browser can show, so the numbers have to come from the reader's session.
  const phaseStats = new Map();
  // Not every host exposes performance in the plugin frame; Date.now is coarser
  // but never throws, and a missing clock must not break a chat read.
  const now = () => (typeof performance === 'object' && performance?.now ? performance.now() : Date.now());
  const mark = (phase, startedAt) => {
    const ms = now() - startedAt;
    const row = phaseStats.get(phase) || { calls: 0, total: 0, worst: 0 };
    row.calls += 1;
    row.total += ms;
    if (ms > row.worst) row.worst = ms;
    phaseStats.set(phase, row);
    return ms;
  };
  const phaseCount = (phase) => {
    const row = phaseStats.get(phase) || { calls: 0, total: 0, worst: 0 };
    row.calls += 1;
    phaseStats.set(phase, row);
  };
  const timed = async (phase, work) => {
    const startedAt = now();
    try {
      return await work();
    } finally {
      mark(phase, startedAt);
    }
  };
  const timedSync = (phase, work) => {
    const startedAt = now();
    try {
      return work();
    } finally {
      mark(phase, startedAt);
    }
  };
  const phaseReport = () =>
    [...phaseStats]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8)
      .map(
        ([phase, row]) =>
          `${phase} x${row.calls} avg ${(row.total / row.calls).toFixed(1)}ms max ${row.worst.toFixed(1)}ms`
      )
      .join('\n') || '-';

  const fail = (where, error) => {
    debugRecord(`ERROR · ${where}`, error?.message || String(error));
    console.error(`[ITEMX 2] ${where}`, error);
  };
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ITEMX_MODULES */

  const pipelineEntries = {
    process: entry('process', processHandler, true),
    output: entry('output', outputFallback, true),
    display: entry('display', displayWithPortraits, true),
    before: entry('before-request', beforeRequest, true),
    after: entry('after-request', afterRequest, true)
  };

  try {
    await loadBadgePosition();
    await dispatch('bootstrap', async () => {
    const setting = await Risuai.registerSetting(
      ITEMXText("runtime.009"),
      entry('settings', openSettingsFromRisuMenu),
      '💎',
      'html',
      'itemx2-current-bot'
    );
    if (setting?.id) hostState.uiParts.push(setting.id);
    await installDisplayHooks();
    const initial = await context();
    let connected = false,
      styled = false;
    if (initial) {
      pipelineState.activeContextKey = initial.key;
      // The display hook is already live, and a compact ref can only become a
      // card once the event ledger is loaded. Load it from the chat we just
      // read, before anything slow runs, or the first paint after a refresh
      // shows the restoring chip where a card belongs.
      refreshLatest(initial.chat);
      uiState.status = ITEMXText("runtime.008");
      await outputSettings(initial.character);
      styled = await installMainStyle();
      const loadingStarted = styled ? Date.now() : 0;
      if (styled) await mountRootLoading(ITEMXText("runtime.007"));
      await updateRootLoading(ITEMXText("runtime.006"));
      connected = await installPipelineHooks();
      await updateRootLoading(ITEMXText("runtime.005"));
      const upgraded = await rebuildCurrent({ upgradeDisplayRefs: true });
      if (!upgraded?.wroteDisplayRefs) await repaintChatBody(await context());
      if (loadingStarted) await delay(Math.max(0, 320 - (Date.now() - loadingStarted)));
      if (styled) await openRootInventory({ open: false });
      void dispatch('update', checkForUpdate);
    } else {
      uiState.status = ITEMXText("runtime.004");
    }
    armRemountWatchdog();
    armCatchUpWatchdog();
    workQueue.schedule(
      'updateTimer',
      () => {
        void dispatch('update', checkForUpdate);
      },
      ITEMX_UPDATE_CHECK_MS,
      true
    );
    if (initial)
      void dispatch('catch-up', catchUpLatestOutput).catch((error) => fail('initial output catch-up', error));
    installBrowserResumeHandlers();
    if (connected && styled) uiState.status = ITEMXText("runtime.003");
    log(`v${ITEMX_PLUGIN_VERSION} ready`);
    });
  } catch (error) {
    uiState.status = ITEMXText("runtime.002");
    await removeRootDrawer();
    await notifyUser(ITEMXText("runtime.001", error.message || error), 'error');
    fail('bootstrap', error);
  }

  await Risuai.onUnload(async () => {
    hostState.unloading = true;
    await workQueue.close();
    clearEventBursts();
    uiState.panelOpen = false;
    workQueue.clearTimer('resumeTimer');
    for (const { target, type, handler } of hostState.resumeBindings) {
      try {
        target.removeEventListener(type, handler);
      } catch {}
    }
    hostState.resumeBindings = [];
    workQueue.clearTimer('remountTimer');

    workQueue.clearTimer('catchUpTimer');
    workQueue.clearTimer('updateTimer');
    workQueue.clearTimer('hostSyncTimer');
    workQueue.clearTimer('feedbackTimer');
    workQueue.clearTimer('auxToastTimer');
    workQueue.clearTimer('legacyCommitTimer');
    clearScrollTimers();
    if (presentationState.bodyFxScrollActive && presentationState.bodyFxClassOwner) {
      try {
        await presentationState.bodyFxClassOwner.removeClass('x-risu-itemx-body-scrolling');
      } catch {}
    }
    presentationState.bodyFxScrollActive = false;
    presentationState.bodyFxSawScroll = false;


    try {
      await Risuai.hideContainer();
    } catch {}
    await removeRootDrawer();
    await removeBodyEffectGovernor();
    try {
      if (hostState.hostObserver?.disconnect) await hostState.hostObserver.disconnect();
    } catch {}
    hostState.hostObserver = null;
    try {
      await Risuai.removeRisuScriptHandler('output', pipelineEntries.output);
    } catch {}
    try {
      await Risuai.removeRisuScriptHandler('display', pipelineEntries.display);
    } catch {}
    try {
      await Risuai.removeRisuScriptHandler('process', pipelineEntries.process);
    } catch {}
    try {
      await Risuai.removeRisuReplacer('beforeRequest', pipelineEntries.before);
    } catch {}
    try {
      await Risuai.removeRisuReplacer('afterRequest', pipelineEntries.after);
    } catch {}
    for (const id of hostState.uiParts) {
      try {
        await Risuai.unregisterUIPart(id);
      } catch {}
    }
    try {
      if (hostState.mainStyle) await hostState.mainStyle.remove();
    } catch {}
  });
})();
