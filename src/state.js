/* Each domain owns its storage closure. Sealed ports expose only the declared
 * contract, so no caller can grow another flat global or add a hidden guard. */
const ITEMXState = (() => {
  function owner(initial) {
    const ports = {};
    for (const key of Object.keys(initial)) Object.defineProperty(ports, key, {
      enumerable: true, get: () => initial[key], set: value => { initial[key] = value; }
    });
    return Object.freeze(ports);
  }
  function create() {
    return Object.freeze({
      host: owner({
        mainDoc: null,
        mainStyle: null,
        uiParts: [],
        hooks: { process: false, output: false, display: false, before: false, after: false, listener: false },
        permissions: { replacer: null, mainDom: null, db: null },
        backgrounded: false,
        resumeBindings: [],
        hostObserver: null,
        hostSettingsCache: { at: 0, visible: false },
        lastDomError: '',
        lastHookError: '',
        unloading: false,
        update: { checking: false, checkedAt: 0, latest: '', available: false }
      }),
      pipeline: owner({
        latestMarkers: new Set(),
        eventPayloads: new Map(),
        cachedLoaded: null,
        generation: 0,
        activeContextKey: '',
        lorebookCache: { key: '', at: 0, rows: [] }
      }),
      aux: owner({
        auxActive: 0,
        auxLast: { state: 'idle', label: '아직 실행 기록 없음', at: 0, events: null }
      }),
      presentation: owner({
        eventBursts: new Map(),
        eventBurstSeen: new Set(),
        eventBurstOwners: new Set(),
        markerHtmlCache: new Map(),
        detailHtmlCache: new Map(),
        presentationRecords: null,
        bodyFxClassOwner: null,
        bodyFxEventIds: [],
        bodyFxSawScroll: false,
        bodyFxScrollActive: false,
        visualEffectsEnabled: true,
        fxMotion: 'full',
        visualSkin: 'dark'
      }),
      portraits: owner({
        portraitCache: new Map(),
        portraitThumbnailCache: new Map(),
        inlinePortraitCatalog: null,
        moduleAssetCache: { key: '', at: 0, rows: [] },
        characterAssetCache: { key: '', at: 0, rows: [] },
        combinedAssetCache: { key: '', at: 0, rows: [] }
      }),
      storage: owner({}),
      settings: owner({
        settingsCache: new Map(),
        debugEnabled: false,
        debugEntries: []
      }),
      ui: owner({
        rootDrawer: null,
        rootOpen: false,
        activeRootTab: 'inventory',
        rootItemPage: 0,
        rootClickBindings: [],
        status: 'UI 준비',
        badgePosition: 'rm',
        compactContainer: true,
        panelOpen: false,
        allowDrawerOverSettings: false,
        backupOpen: false,
        cleanupArmedUntil: 0,
        storageCleanupArmedUntil: 0,
        historyView: { open: false, key: '', domain: 'item', filter: 'recent', selected: null, page: 0 },
        historyRows: [],
        view: { query: '' }
      }),
    });
  }
  return { create };
})();
