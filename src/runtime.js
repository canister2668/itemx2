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
  // Reading a chat marshals every message across the host bridge, and a single
  // reply walks that path several times. The queue runs one job at a time, so
  // within a job nothing can change the chat under us: the first read serves the
  // rest, and a write replaces the entry with what we just stored instead of
  // fetching it straight back. Outside a job nothing is reused.
  let chatCache = null;
  const chatCacheKey = (characterIndex, chatIndex) => `${characterIndex}:${chatIndex}`;
  const invalidateChatCache = () => {
    chatCache = null;
  };
  const readChat = async (characterIndex, chatIndex, ...rest) => {
    const token = workQueue.token,
      key = chatCacheKey(characterIndex, chatIndex);
    if (token && chatCache && chatCache.token === token && chatCache.key === key) {
      phaseCount('host:readChat:reused');
      return chatCache.chat;
    }
    const raw = await timed('host:readChat', () => Risuai.getChatFromIndex(characterIndex, chatIndex, ...rest));
    const chat = timedSync('storage:hydrate', () => ITEMXStorage.hydrate(raw));
    if (token) chatCache = { token, key, chat };
    return chat;
  };
  const saveChat = (characterIndex, chatIndex, chat) => {
    workQueue.assertCurrent();
    const persisted = timedSync('storage:persist', () => ITEMXStorage.persist(chat));
    const token = workQueue.token;
    chatCache = token ? { token, key: chatCacheKey(characterIndex, chatIndex), chat } : null;
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
      uiState.status = ITEMXText("runtime.008");
      await outputSettings(initial.character);
      styled = await installMainStyle();
      const loadingStarted = styled ? Date.now() : 0;
      if (styled) await mountRootLoading(ITEMXText("runtime.007"));
      await updateRootLoading(ITEMXText("runtime.006"));
      connected = await installPipelineHooks();
      await updateRootLoading(ITEMXText("runtime.005"));
      await rebuildCurrent({ upgradeDisplayRefs: true });
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
