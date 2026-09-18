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
      reentrant: ['process', 'output', 'display', 'before-request', 'after-request'].includes(kind)
    });
  const entry =
    (kind, work, unique = false) =>
    (...args) =>
      dispatch(kind, () => work(...args), unique);
  const readChat = async (...args) => ITEMXStorage.hydrate(await Risuai.getChatFromIndex(...args));
  const saveChat = (characterIndex, chatIndex, chat) => {
    workQueue.assertCurrent();
    return Risuai.setChatToIndex(characterIndex, chatIndex, ITEMXStorage.persist(chat));
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
      'ITEMX CODEX · 권한 및 설정',
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
      uiState.status = '초기 화면 연결 중';
      await outputSettings(initial.character);
      styled = await installMainStyle();
      const loadingStarted = styled ? Date.now() : 0;
      if (styled) await mountRootLoading('ITEMX CODEX 초기화 중…');
      await updateRootLoading('모델 처리 연결 중…');
      connected = await installPipelineHooks();
      await updateRootLoading('채팅 인벤토리 복원 중…');
      await rebuildCurrent({ upgradeDisplayRefs: true });
      if (loadingStarted) await delay(Math.max(0, 320 - (Date.now() - loadingStarted)));
      if (styled) await openRootInventory({ open: false });
      void dispatch('update', checkForUpdate);
    } else {
      uiState.status = '채팅 진입 대기';
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
    if (connected && styled) uiState.status = '정상';
    log(`v${ITEMX_PLUGIN_VERSION} ready`);
    });
  } catch (error) {
    uiState.status = '초기화 오류';
    await removeRootDrawer();
    await notifyUser(`ITEMX CODEX 초기화 실패: ${error.message || error}`, 'error');
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
    workQueue.clearTimer('bodyFxStartTimer');
    workQueue.clearTimer('bodyFxScrollTimer');
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
