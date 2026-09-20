/* ITEMX ui settings owner. Concatenated inside the runtime closure. */
  function compareVersions(left, right) {
    const parse = (value) => {
      const [main, prerelease = ''] = String(value || '')
        .trim()
        .replace(/^v/i, '')
        .split('-', 2);
      return {
        main: main.split('.').map((part) => Number.parseInt(part, 10) || 0),
        pre: prerelease ? prerelease.split('.') : []
      };
    };
    const a = parse(left),
      b = parse(right);
    for (let index = 0; index < Math.max(a.main.length, b.main.length); index += 1) {
      const difference = (a.main[index] || 0) - (b.main[index] || 0);
      if (difference) return difference > 0 ? 1 : -1;
    }
    if (!a.pre.length || !b.pre.length) return a.pre.length === b.pre.length ? 0 : a.pre.length ? -1 : 1;
    for (let index = 0; index < Math.max(a.pre.length, b.pre.length); index += 1) {
      if (a.pre[index] == null || b.pre[index] == null) return a.pre[index] == null ? -1 : 1;
      if (a.pre[index] === b.pre[index]) continue;
      const aNumber = /^\d+$/.test(a.pre[index]) ? Number(a.pre[index]) : null;
      const bNumber = /^\d+$/.test(b.pre[index]) ? Number(b.pre[index]) : null;
      if (aNumber != null && bNumber != null) return aNumber > bNumber ? 1 : -1;
      if (aNumber != null || bNumber != null) return aNumber != null ? -1 : 1;
      return a.pre[index] > b.pre[index] ? 1 : -1;
    }
    return 0;
  }

  async function syncUpdateIndicator() {
    if (!hostState.mainDoc || !uiState.rootDrawer) return;
    try {
      const current = await hostState.mainDoc.querySelector('.x-risu-itemx2-update-indicator');
      const currentLabel = await hostState.mainDoc.querySelector('.x-risu-itemx2-update-label');
      if (!hostState.update.available) {
        if (current) await current.remove();
        if (currentLabel) await currentLabel.remove();
        return;
      }
      if (current) {
        await current.setAttribute('x-itemx2-update', hostState.update.latest);
      } else {
        const badge = await hostState.mainDoc.querySelector('.x-risu-itemx2-native-badge');
        if (badge) {
          const indicator = await hostState.mainDoc.createElement('span');
          await indicator.setClassName('x-risu-itemx2-update-indicator');
          await indicator.setAttribute('x-itemx2-update', hostState.update.latest);
          await indicator.setTextContent('↑');
          await badge.appendChild(indicator);
        }
      }
      if (!currentLabel) {
        const eyebrow = await hostState.mainDoc.querySelector('.x-risu-itemx-ph-eyebrow');
        if (eyebrow) {
          const label = await hostState.mainDoc.createElement('span');
          await label.setClassName('x-risu-itemx2-update-label');
          await label.setAttribute('x-itemx2-update', hostState.update.latest);
          await label.setTextContent('UPDATE');
          await eyebrow.appendChild(label);
        }
      }
    } catch (error) {
      fail('update indicator', error);
    }
  }

  async function checkForUpdate() {
    if (hostState.update.checking || !pipelineState.activeContextKey || typeof Risuai.nativeFetch !== 'function') return;
    hostState.update.checking = true;
    try {
      let cached = null;
      try {
        cached = JSON.parse((await Risuai.safeLocalStorage.getItem(ITEMX_UPDATE_CACHE_KEY)) || 'null');
      } catch {}
      if (cached?.latest) {
        hostState.update.checkedAt = Number(cached.checkedAt) || 0;
        hostState.update.latest = String(cached.latest);
        hostState.update.available = compareVersions(hostState.update.latest, ITEMX_PLUGIN_VERSION) > 0;
        await syncUpdateIndicator();
      }
      if (Date.now() - hostState.update.checkedAt < ITEMX_UPDATE_CHECK_MS) return;
      const response = await withTimeout(
        Risuai.nativeFetch(ITEMX_UPDATE_URL, {
          method: 'GET',
          headers: { Range: 'bytes=0-2047' },
          cache: 'no-store'
        }),
        6000,
        ITEMXText("ui-settings.151")
      );
      if (!response?.ok) throw new Error(ITEMXText("ui-settings.149", response?.status || ITEMXText("ui-settings.150")));
      const header = String((await response.text()) || '');
      const latest = header.match(/^\/\/@version\s+([^\s]+)\s*$/m)?.[1] || '';
      if (!latest) throw new Error(ITEMXText("ui-settings.148"));
      hostState.update.checkedAt = Date.now();
      hostState.update.latest = latest;
      hostState.update.available = compareVersions(latest, ITEMX_PLUGIN_VERSION) > 0;
      try {
        await Risuai.safeLocalStorage.setItem(
          ITEMX_UPDATE_CACHE_KEY,
          JSON.stringify({ checkedAt: hostState.update.checkedAt, latest })
        );
      } catch {}
      await syncUpdateIndicator();
    } catch (error) {
      debugRecord('update check', error?.message || String(error));
    } finally {
      hostState.update.checking = false;
    }
  }

  const messageData = (message) => ITEMXCore.messageText(message);

  const markerCodes = (text) => {
    const out = new Set();
    String(text || '').replace(ITEMXCore.MARKER_RE, (_, code) => {
      out.add(`ITEMX2:${code}`);
      return '';
    });
    String(text || '').replace(ITEMXCodex.MARKER_RE, (_, code) => {
      out.add(`CODEX2:${code}`);
      return '';
    });
    String(text || '').replace(ITEMX_REF_RE, (_, ref) => {
      out.add(`ITEMX2@${ref}`);
      return '';
    });
    String(text || '').replace(ITEMX_CODEX_REF_RE, (_, ref) => {
      out.add(`CODEX2@${ref}`);
      return '';
    });
    return out;
  };

  const settingsId = (character) => character?.chaId || 'unknown';

  const cachedSettings = (character) => settingsState.settingsCache.get(settingsId(character));

  function updateCachedSettings(character, patch) {
    const id = settingsId(character),
      current = settingsState.settingsCache.get(id);
    if (current) settingsState.settingsCache.set(id, { ...current, ...patch });
    if ('effectsLevel' in patch) {
      presentationState.fxMotion = FX_MODES.includes(patch.effectsLevel) ? patch.effectsLevel : 'full';
      presentationState.visualEffectsEnabled = presentationState.fxMotion !== 'off';
    }
    if ('skin' in patch) presentationState.visualSkin = SKIN_MODES.includes(patch.skin) ? patch.skin : 'dark';
  }

  async function outputSettings(character, { refresh = false } = {}) {
    const id = settingsId(character);
    if (!refresh && settingsState.settingsCache.has(id)) return { ...settingsState.settingsCache.get(id) };
    const document = await ITEMXSettings.read(Risuai.pluginStorage);
    const settings = ITEMXSettings.normalize(document.characters[id]);
    settingsState.settingsCache.set(id, settings);
    presentationState.fxMotion = settings.effectsLevel;
    presentationState.visualEffectsEnabled = settings.effectsLevel !== 'off';
    presentationState.visualSkin = settings.skin;
    return { ...settings };
  }

  const writeSetting = (character, key, value) => ITEMXSettings.update(Risuai.pluginStorage, settingsId(character), { [key]: value });

  async function isEnabled(character) {
    return (cachedSettings(character) || (await outputSettings(character))).enabled;
  }

  async function setEnabled(character, value) {
    await writeSetting(character, 'enabled', Boolean(value));
    updateCachedSettings(character, { enabled: Boolean(value) });
  }

  async function setDomainEnabled(character, domain, value) {
    const keys = { items: 'itemsEnabled', skills: 'skillsEnabled', encounters: 'encountersEnabled' };
    if (!keys[domain]) throw new Error('Invalid ITEMX domain');
    await writeSetting(character, keys[domain], Boolean(value));
    updateCachedSettings(character, { [keys[domain]]: Boolean(value) });
    workQueue.forget('catch-up');
    workQueue.forget('aux-settle');
  }

  async function setDebugEnabled(character, value) {
    settingsState.debugEnabled = Boolean(value);
    await writeSetting(character, 'debugEnabled', Boolean(value));
    updateCachedSettings(character, { debugEnabled: Boolean(value) });
    debugRecord('debug', value ? 'enabled' : 'disabled');
  }

  async function setMainOutput(character, value) {
    await writeSetting(character, 'mainOutput', Boolean(value));
    updateCachedSettings(character, { mainOutput: Boolean(value) });
  }

  async function setAuxOutput(character, value) {
    if (!['off', 'missing', 'always'].includes(value)) throw new Error('Invalid auxiliary output mode');
    await writeSetting(character, 'auxOutput', value);
    updateCachedSettings(character, { auxOutput: value });
    workQueue.forget('catch-up');
    workQueue.forget('aux-settle');
  }

  async function setRarityMode(character, value) {
    if (!['world', 'itemx'].includes(value)) throw new Error('Invalid rarity mode');
    await writeSetting(character, 'rarityMode', value);
    updateCachedSettings(character, { rarityMode: value });
  }

  async function setEffectsLevel(character, value) {
    if (!FX_MODES.includes(value)) throw new Error('Invalid ITEMX effect level');
    await writeSetting(character, 'effectsLevel', value);
    updateCachedSettings(character, { effectsLevel: value });
    presentationState.markerHtmlCache.clear();
    presentationState.detailHtmlCache.clear();
    await syncMainEffectsState();
  }

  async function setFontScale(character, value) {
    if (!['small', 'medium', 'large'].includes(value)) throw new Error('Invalid font scale');
    await writeSetting(character, 'fontScale', value);
    updateCachedSettings(character, { fontScale: value });
    await syncRootFontScale(value);
  }

  async function setModuleAssetsEnabled(character, value) {
    await writeSetting(character, 'moduleAssetsEnabled', Boolean(value));
    updateCachedSettings(character, { moduleAssetsEnabled: Boolean(value) });
    portraitsState.moduleAssetCache = { key: '', at: 0, rows: [] };
  }

  async function setLorebookEncounterEnabled(character, value) {
    await writeSetting(character, 'lorebookEncounterEnabled', Boolean(value));
    updateCachedSettings(character, { lorebookEncounterEnabled: Boolean(value) });
    workQueue.remember('lorebook', '');
  }

  const FX_MODES = ['full', 'lite', 'off'];
  const FX_LABELS = { full: ITEMXText("ui-settings.fx-full"), lite: ITEMXText("ui-settings.fx-lite"), off: ITEMXText("ui-settings.fx-off") };
  const AUX_LABELS = { off: ITEMXText("ui-settings.147"), missing: ITEMXText("ui-settings.146"), always: ITEMXText("ui-settings.145") };

  const RARITY_MODE_LABELS = { world: ITEMXText("ui-settings.144"), itemx: ITEMXText("ui-settings.143") };

  async function loadBadgePosition() {
    const saved = (await ITEMXSettings.read(Risuai.pluginStorage)).global.badgePosition;
    if (BADGE_POSITIONS.some(([value]) => value === saved)) uiState.badgePosition = saved;
  }

  function backupSettingsHtml(native) {
    return setCard(
      ITEMXText("ui-settings.142"),
      ITEMXText("ui-settings.141"),
      ITEMXText("ui-settings.140")
    );
  }

  async function openBackupPanel() {
    if (uiState.backupOpen) return;
    const ctx = await context();
    if (!ctx) throw new Error(ITEMXText("ui-settings.139"));
    uiState.backupOpen = true;
    let preview = null,
      url = '',
      busy = false;
    document.body.innerHTML = ITEMXText("ui-settings.138");
    const style = document.createElement('style');
    style.textContent =
      'body{margin:0;background:#0c121c;color:#e4eaf4;font:15px/1.6 system-ui}#itemx-backup{max-width:680px;margin:auto;padding:20px;box-sizing:border-box}#itemx-backup header{display:flex;align-items:center;justify-content:space-between;gap:12px}#itemx-backup section{padding:16px;margin:16px 0;border:1px solid #33435d;border-radius:12px}#itemx-backup button,#itemx-backup a{display:inline-block;padding:10px;margin:4px;border:1px solid #536884;border-radius:8px;background:#1a2940;color:#eef3fc;font:inherit;cursor:pointer}#itemx-backup [hidden]{display:none}#itemx-backup button:disabled{opacity:.45;cursor:default}#itemx-backup textarea{display:block;box-sizing:border-box;width:100%;min-height:105px;margin:12px 0;padding:10px;background:#090e17;color:#d9e6fc;border:1px solid #40516c;border-radius:8px}#itemx-backup input,#itemx-backup select{max-width:100%}#itemx-backup select{padding:8px;background:#1a2940;color:#eef3fc;border:1px solid #536884;border-radius:8px}#itemx-backup p{overflow-wrap:anywhere}#ix-status{padding:10px;background:#142137}';
    document.head.appendChild(style);
    const get = (id) => document.getElementById(id);
    get('ix-target').textContent = ITEMXText("ui-settings.135", ctx.character.name || ITEMXText("ui-settings.136"), ctx.chat.name || ITEMXText("ui-settings.137"));
    const status = (text) => {
      get('ix-status').textContent = text;
    };
    const countText = (value) => {
      const [i, s, m] = ITEMXBackup.counts(value);
      return ITEMXText("ui-settings.134", i, s, m);
    };
    const run = async (work) => {
      if (busy) return;
      busy = true;
      try {
        await work();
      } catch (error) {
        status(error.message || String(error));
      } finally {
        busy = false;
      }
    };
    const invalidate = () => {
      preview = null;
      get('ix-import').disabled = true;
      get('ix-preview-text').textContent = '';
    };
    get('ix-close').onclick = entry(
      'ui-action',
      () =>
        run(async () => {
          if (url) URL.revokeObjectURL(url);
          style.remove();
          uiState.backupOpen = false;
          await Risuai.hideContainer();
          await openRootInventory({ open: true, tab: 'settings' });
        }),
      true
    );
    get('ix-export').onclick = entry(
      'ui-action',
      () =>
        run(async () => {
          const value = await exportCurrentBackup(ctx.key),
            text = JSON.stringify(value);
          get('ix-export-text').value = text;
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
          const link = get('ix-download');
          link.href = url;
          link.download = `itemx-backup-${new Date().toISOString().slice(0, 10)}.json`;
          link.hidden = false;
          get('ix-copy').disabled = false;
          status(ITEMXText("ui-settings.133", countText(value)));
        }),
      true
    );
    get('ix-copy').onclick = entry(
      'ui-action',
      () =>
        run(async () => {
          const area = get('ix-export-text');
          area.focus();
          area.select();
          try {
            await navigator.clipboard.writeText(area.value);
            status(ITEMXText("ui-settings.132"));
          } catch {
            status(ITEMXText("ui-settings.131"));
          }
        }),
      true
    );
    get('ix-import-text').oninput = invalidate;
    get('ix-mode').onchange = invalidate;
    get('ix-file').onchange = () =>
      run(async () => {
        invalidate();
        const file = get('ix-file').files[0];
        if (!file) return;
        get('ix-import-text').value = '';
        if (file.size > ITEMXBackup.MAX_BYTES) throw new Error(ITEMXText("ui-settings.130"));
        get('ix-import-text').value = await file.text();
        status(ITEMXText("ui-settings.129"));
      });
    get('ix-preview').onclick = entry(
      'ui-action',
      () =>
        run(async () => {
          invalidate();
          const text = get('ix-import-text').value;
          const mode = get('ix-mode').value;
          const prepared = await prepareBackupImport(text, ctx.key, mode);
          if (get('ix-import-text').value !== text || get('ix-mode').value !== mode)
            throw new Error(ITEMXText("ui-settings.128"));
          preview = prepared;
          get('ix-preview-text').textContent =
            `${preview.value.source} · ${preview.value.createdAt} · ${countText(preview.value)}${mode === 'replace' ? ITEMXText("ui-settings.127", preview.previousCounts[0], preview.previousCounts[1], preview.previousCounts[2]) : ''}`;
          get('ix-import').textContent = mode === 'replace' ? ITEMXText("ui-settings.126") : ITEMXText("ui-settings.125");
          get('ix-import').disabled = false;
          status(ITEMXText("ui-settings.124"));
        }),
      true
    );
    get('ix-import').onclick = entry(
      'ui-action',
      () =>
        run(async () => {
          if (!preview) return;
          get('ix-import').disabled = true;
          const ready = preview;
          preview = null;
          const value = await commitBackupImport(ready);
          status(ITEMXText("ui-settings.123", countText(value)));
        }),
      true
    );
    try {
      await Risuai.showContainer('fullscreen');
    } catch (error) {
      uiState.backupOpen = false;
      style.remove();
      throw error;
    }
  }

  const NATIVE_ACTION_ALIASES = { 'main-output': 'main', 'lorebook-toggle': 'lorebook', 'cleanup-chat': 'cleanup' };

  const SETTINGS_SKINS = {
    native: {
      native: true,
      hook: (action) => ` itemx2-setting-${NATIVE_ACTION_ALIASES[action] || action}`,
      data: () => '',
      segHook: (group, value) => ` itemx2-seg-${group}-${value}`,
      segData: () => '',
      choiceData: () => ''
    },
    frame: {
      native: false,
      hook: () => '',
      data: (action) => ` data-action="${action}"`,
      segHook: () => '',
      segData: (group, value) => ` data-seg="${group}" data-value="${value}"`,
      choiceData: (name, value) => ` data-${name}="${value}"`
    }
  };

  const setCard = (title, note, control = '', extra = '') =>
    `<section class="itemx2-root-setting-card"><span><strong>${title}</strong><small${extra}>${note}</small></span>${control}</section>`;

  const setButton = (skin, action, label, extra = '') =>
    `<button class="itemx2-root-setting-button${skin.hook(action)}${extra}" type="button"${skin.data(action)}>${label}</button>`;

  const setSwitch = (skin, action, on) =>
    `<button class="itemx2-root-setting-button itemx2-sw${skin.hook(action)}${on ? ' itemx2-setting-on' : ''}" type="button" role="switch" aria-checked="${on ? 'true' : 'false'}"${skin.data(action)}><i></i></button>`;

  const setSegment = (skin, group, entries, current) =>
    `<div class="itemx2-seg">${entries
      .map(
        ([value, label]) =>
          `<button class="itemx2-seg-btn${skin.segHook(group, value)}${current === value ? ' itemx2-seg-on' : ''}" type="button"${skin.segData(group, value)}>${label}</button>`
      )
      .join('')}</div>`;

  function settingsPanelHtml(loaded, skin, parts) {
    const enabled = loaded.enabled === true;
    const connection = parts.connection;
    const connectionCards = skin.native
      ? setCard(
          ITEMXText("ui-settings.122"),
          ITEMXText("ui-settings.121"),
          setButton(
            skin,
            'connect',
            workQueue.isActive('connect') ? ITEMXText("ui-settings.120") : connection.ready ? ITEMXText("ui-settings.119") : ITEMXText("ui-settings.118"),
            ` itemx2-root-setting-button-primary${workQueue.isActive('connect') ? ' itemx2-root-setting-button-busy' : ''}`
          )
        ).replace('</small>', `</small><span class="itemx2-status-row">${parts.chips}</span>`)
      : // The fallback exists because main-document access was refused, so it
        // offers the two repair actions the drawer never has to show.
        setCard(
          ITEMXText("ui-settings.117"),
          ITEMXText("ui-settings.116", parts.permissionLabel),
          setButton(skin, 'permissions', ITEMXText("ui-settings.115"))
        ) +
        setCard(
          ITEMXText("ui-settings.114"),
          ITEMXText("ui-settings.113", parts.styleLabel),
          setButton(skin, 'style', ITEMXText("ui-settings.112"))
        );
    return ITEMXText("ui-settings.074", connectionCards, setCard(
      ITEMXText("ui-settings.077"),
      ITEMXCore.esc(auxStatusText()),
      `<button class="itemx2-root-setting-button${skin.hook('aux-run')}" type="button"${skin.data('aux-run')} ${auxState.auxActive > 0 ? 'disabled' : ''}>${auxState.auxActive > 0 ? ITEMXText("ui-settings.076") : ITEMXText("ui-settings.075")}</button>`,
      ' class="itemx2-aux-setting-status"'
    ), setCard(
      ITEMXText("ui-settings.079"),
      ITEMXText("ui-settings.078")
    ), parts.domainControls, setCard(
      ITEMXText("ui-settings.084"),
      ITEMXText("ui-settings.083"),
      setSwitch(skin, 'main-output', loaded.mainOutput)
    ), setCard(
      ITEMXText("ui-settings.086"),
      ITEMXText("ui-settings.085"),
      setSegment(skin, 'aux', Object.entries(AUX_LABELS), loaded.auxOutput)
    ), setCard(
      ITEMXText("ui-settings.088"),
      ITEMXText("ui-settings.087"),
      setSegment(skin, 'rarity', Object.entries(RARITY_MODE_LABELS), loaded.rarityMode)
    ), setCard(
      ITEMXText("ui-settings.091"),
      ITEMXText("ui-settings.090"),
      `<span class="itemx2-manager-actions">${setSwitch(skin, 'lorebook-toggle', loaded.lorebookEncounterEnabled)}${setButton(skin, 'lorebook-scan', ITEMXText("ui-settings.089"))}</span>`
    ), setCard(
      ITEMXText("ui-settings.093"),
      ITEMXText("ui-settings.092"),
      setSwitch(skin, 'module-assets', loaded.moduleAssetsEnabled)
    ), setCard(
      ITEMXText("ui-settings.095"),
      ITEMXText("ui-settings.094"),
      setSegment(
        skin,
        'skin',
        SKIN_MODES.map((mode) => [mode, SKIN_LABELS[mode]]),
        loaded.skin || 'dark'
      )
    ), setCard(
      ITEMXText("ui-settings.fx-title"),
      ITEMXText("ui-settings.fx-note"),
      setSegment(skin, 'fx', Object.entries(FX_LABELS), loaded.effectsLevel)
    ), setCard(ITEMXText("ui-settings.099"), ITEMXText("ui-settings.098")), parts.fontChoices, setCard(
      ITEMXText("ui-settings.101"),
      ITEMXText("ui-settings.100")
    ), parts.positionChoices, parts.manager, backupSettingsHtml(skin.native), setCard(
      ITEMXText("ui-settings.106"),
      ITEMXText("ui-settings.105", parts.footprintLabel),
      `<span class="itemx2-manager-actions">${setButton(skin, 'rebuild', ITEMXText("ui-settings.104"))}${setButton(skin, 'storage-cleanup', parts.storageCleanupArmed ? ITEMXText("ui-settings.103") : ITEMXText("ui-settings.102"), parts.storageCleanupArmed ? ' itemx2-setting-cleanup-armed' : '')}</span>`
    ), setCard(
      ITEMXText("ui-settings.110"),
      ITEMXText("ui-settings.109"),
      setButton(
        skin,
        'cleanup-chat',
        parts.cleanupArmed ? ITEMXText("ui-settings.108") : ITEMXText("ui-settings.107"),
        parts.cleanupArmed ? ' itemx2-setting-cleanup-armed' : ''
      )
    ), parts.debugPanel, setCard(ITEMXText("ui-settings.111"), `ITEMX CODEX ${ITEMX_PLUGIN_VERSION}`));
  }

  function settingsDomainControls(loaded, skin) {
    return [
      ['items', ITEMXText("ui-settings.073"), loaded.itemsEnabled, ITEMXText("ui-settings.072")],
      ['skills', ITEMXText("ui-settings.071"), loaded.skillsEnabled, ITEMXText("ui-settings.070")],
      ['encounters', ITEMXText("ui-settings.069"), loaded.encountersEnabled, ITEMXText("ui-settings.068")]
    ]
      .map(
        ([key, label, value, note]) =>
          `<button class="itemx2-domain-card${skin.hook(`domain-${key}`)} ${value ? 'itemx2-setting-on' : ''}" type="button"${skin.data(`domain-${key}`)}><strong>${label}</strong><small>${note}</small><i>${value ? ITEMXText("ui-settings.067") : ITEMXText("ui-settings.066")}</i></button>`
      )
      .join('');
  }

  function settingsFontChoices(loaded, skin) {
    return [
      ['small', ITEMXText("ui-settings.065")],
      ['medium', ITEMXText("ui-settings.064")],
      ['large', ITEMXText("ui-settings.063")]
    ]
      .map(
        ([value, label]) =>
          ITEMXText("ui-settings.062", value, loaded.fontScale === value ? 'itemx2-font-on' : '', skin.choiceData('font', value), label)
      )
      .join('');
  }

  function settingsPositionChoices(skin) {
    const positionLabel = (BADGE_POSITIONS.find(([key]) => key === uiState.badgePosition) || BADGE_POSITIONS[0])[1];
    // A map of the screen beats six abbreviations: the slot sits where the badge will.
    return ITEMXText("ui-settings.061", BADGE_POSITIONS.map(
      ([key, label]) =>
        `<button class="itemx2-position-choice itemx2-position-${key} ${uiState.badgePosition === key ? 'itemx2-position-on' : ''}" type="button"${skin.choiceData('position', key)} aria-label="${label}"></button>`
    ).join(
      ''
    ), positionLabel);
  }

  function settingsStorageParts(loaded) {
    const footprint = itemxStorageFootprint(loaded.chat);
    return {
      cleanupArmed: uiState.cleanupArmedUntil > Date.now(),
      storageCleanupArmed: uiState.storageCleanupArmedUntil > Date.now(),
      footprintLabel: ITEMXText("ui-settings.060", Math.max(1, Math.ceil(footprint.totalBytes / 1024)), footprint.markerCount)
    };
  }

  function settingsDebugLog() {
    return (
      settingsState.debugEntries
        .slice(-12)
        .reverse()
        .map(
          (entry) =>
            `${new Date(entry.at).toLocaleTimeString('ko-KR', { hour12: false })} ${entry.where}\n${entry.detail}`
        )
        .join('\n\n') || ITEMXText("ui-settings.059")
    );
  }

  function rootSettingActions() {
    const toggleSetting = (hook, read, write, label) => ({
      hook,
      run: () =>
        applyRootSetting(async () => {
          const loaded = await cachedOrRebuildCurrent();
          if (!loaded) return;
          const current = cachedSettings(loaded.character) || (await outputSettings(loaded.character));
          const value = !read(current);
          await write(loaded, value);
          uiState.status = `${label} · ${value ? 'ON' : 'OFF'}`;
          await updateRootSwitch(`.x-risu-${hook}`, value);
        })
    });
    const armed = (key, arm, confirmed) => async () => {
      if (uiState[key] <= Date.now()) {
        uiState[key] = Date.now() + 7000;
        await arm();
        await openRootInventory({ open: true, tab: 'settings' });
        return;
      }
      await confirmed();
    };
    return [
      {
        hook: 'itemx2-setting-connect',
        run: async () => {
          const restoreStage = workQueue.stage('connect');
          uiState.status = ITEMXText("ui-settings.058");
          await updateConnectionUi();
          await showRootFeedback(ITEMXText("ui-settings.057"), 'working', 0);
          try {
            const connected = await installPipelineHooks({ prompt: true });
            const styled = await installMainStyle();
            uiState.status =
              connected && styled ? ITEMXText("ui-settings.056") : connected ? ITEMXText("ui-settings.055") : ITEMXText("ui-settings.054");
            if (connected && styled) {
              await showRootFeedback(ITEMXText("ui-settings.053"), 'success');
            } else {
              await showRootFeedback(
                ITEMXText("ui-settings.052", (!connected ? hostState.lastHookError : hostState.lastDomError) || uiState.status),
                'error',
                3600
              );
            }
            if (!connected || !styled)
              await notifyUser(
                ITEMXText("ui-settings.051", (!connected ? hostState.lastHookError : hostState.lastDomError) || uiState.status),
                'error'
              );
          } finally {
            restoreStage();
            await updateConnectionUi();
          }
        }
      },
      {
        hook: 'itemx2-setting-aux-run',
        run: async () => {
          if (auxState.auxActive > 0) return;
          uiState.status = ITEMXText("ui-settings.050");
          await recoverAuxiliaryOutput({ force: true });
        }
      },
      ...BADGE_POSITIONS.map(([key, label]) => ({
        hook: `itemx2-position-${key}`,
        run: async () => {
          uiState.badgePosition = key;
          await ITEMXSettings.update(Risuai.pluginStorage, null, { badgePosition: key });
          uiState.status = ITEMXText("ui-settings.049", label);
          if (uiState.rootDrawer) {
            for (const [other] of BADGE_POSITIONS) await uiState.rootDrawer.removeClass(`x-risu-itemx2-pos-${other}`);
            await uiState.rootDrawer.addClass(`x-risu-itemx2-pos-${key}`);
          }
          await installMainStyle();
          for (const [other] of BADGE_POSITIONS) {
            const button = await queryMainClass(`itemx2-position-${other}`);
            if (!button) continue;
            if (other === key) await button.addClass('x-risu-itemx2-position-on');
            else await button.removeClass('x-risu-itemx2-position-on');
          }
        }
      })),
      {
        hook: 'itemx2-setting-toggle',
        header: true,
        run: () =>
          applyRootSetting(async () => {
            const loaded = await rebuildCurrent();
            if (!loaded) return;
            const next = !(await isEnabled(loaded.character));
            await setEnabled(loaded.character, next);
            uiState.status = next ? ITEMXText("ui-settings.048") : ITEMXText("ui-settings.047");
            await updateRootSwitch('.x-risu-itemx2-setting-toggle', next, 'x-risu-itemx2-power-on');
          })
      },
      ...[
        ['items', 'itemsEnabled', ITEMXText("ui-settings.046")],
        ['skills', 'skillsEnabled', ITEMXText("ui-settings.045")],
        ['encounters', 'encountersEnabled', ITEMXText("ui-settings.044")]
      ].map(([domain, key, label]) => ({
        hook: `itemx2-setting-domain-${domain}`,
        run: () =>
          applyRootSetting(async () => {
            const loaded = await rebuildCurrent();
            if (!loaded) return;
            const current = await outputSettings(loaded.character),
              value = !current[key];
            await setDomainEnabled(loaded.character, domain, value);
            pipelineState.cachedLoaded = null;
            uiState.status = `${label} · ${value ? 'ON' : 'OFF'}`;
            await updateRootDomainCard(
              `.x-risu-itemx2-setting-domain-${domain}`,
              value,
              value ? ITEMXText("ui-settings.067") : ITEMXText("ui-settings.066")
            );
          })
      })),
      {
        hook: 'itemx2-setting-debug',
        run: () =>
          applyRootSetting(async () => {
            const loaded = await rebuildCurrent();
            if (!loaded) return;
            const value = !(await outputSettings(loaded.character)).debugEnabled;
            await setDebugEnabled(loaded.character, value);
            pipelineState.cachedLoaded = null;
            uiState.status = ITEMXText("ui-settings.043", value ? 'ON' : 'OFF');
            await openRootInventory({ open: true, tab: 'settings' });
          })
      },
      {
        hook: 'itemx2-setting-debug-clear',
        run: async () => {
          settingsState.debugEntries = [];
          uiState.status = ITEMXText("ui-settings.042");
          await openRootInventory({ open: true, tab: 'settings' });
        }
      },
      {
        hook: 'itemx2-setting-main',
        run: () =>
          applyRootSetting(async () => {
            const loaded = await rebuildCurrent();
            if (!loaded) return;
            const value = !(await outputSettings(loaded.character)).mainOutput;
            await setMainOutput(loaded.character, value);
            uiState.status = ITEMXText("ui-settings.041", value ? 'ON' : 'OFF');
            await updateRootSwitch('.x-risu-itemx2-setting-main', value);
          })
      },
      // Multi-choice settings render every option, so one row per option.
      ...[
        [
          'aux',
          Object.keys(AUX_LABELS),
          async (loaded, value) => {
            await setAuxOutput(loaded.character, value);
            uiState.status = ITEMXText("ui-settings.040", AUX_LABELS[value]);
          }
        ],
        [
          'rarity',
          Object.keys(RARITY_MODE_LABELS),
          async (loaded, value) => {
            await setRarityMode(loaded.character, value);
            uiState.status = ITEMXText("ui-settings.039", RARITY_MODE_LABELS[value]);
          }
        ],
        [
          'fx',
          FX_MODES,
          async (loaded, value) => {
            await setEffectsLevel(loaded.character, value);
            loaded.effectsLevel = value;
            uiState.status = ITEMXText("ui-settings.fx-status", FX_LABELS[value]);
          }
        ],
        [
          'skin',
          SKIN_MODES,
          async (loaded, value) => {
            await setSkin(loaded.character, value);
            loaded.skin = value;
            uiState.status = ITEMXText("ui-settings.038", SKIN_LABELS[value]);
          }
        ]
      ].flatMap(([group, values, apply]) =>
        values.map((value) => ({
          hook: `itemx2-seg-${group}-${value}`,
          run: () =>
            applyRootSetting(async () => {
              const loaded = await cachedOrRebuildCurrent();
              if (!loaded) return;
              await apply(loaded, value);
              await updateRootSegment(group, values, value);
            })
        }))
      ),

      {
        hook: 'itemx2-setting-lorebook',
        run: () =>
          applyRootSetting(async () => {
            const loaded = await cachedOrRebuildCurrent();
            if (!loaded) return;
            const value = !(cachedSettings(loaded.character) || (await outputSettings(loaded.character)))
              .lorebookEncounterEnabled;
            await setLorebookEncounterEnabled(loaded.character, value);
            loaded.lorebookEncounterEnabled = value;
            uiState.status = ITEMXText("ui-settings.036", value ? 'ON' : 'OFF');
            if (value) await scanLorebookEncounters({ refresh: true, silent: true });
            await updateRootSwitch('.x-risu-itemx2-setting-lorebook', value);
          })
      },
      {
        hook: 'itemx2-setting-lorebook-scan',
        run: async () => {
          await scanLorebookEncounters({ refresh: true });
          await openRootInventory({ open: true, tab: 'settings' });
        }
      },
      {
        // Not a plain toggle: turning it on asks the host for module access and
        // can come back refused, which is a third outcome the status must say.
        hook: 'itemx2-setting-module-assets',
        run: () =>
          applyRootSetting(async () => {
            const loaded = await cachedOrRebuildCurrent();
            if (!loaded) return;
            const current = cachedSettings(loaded.character) || (await outputSettings(loaded.character));
            let value = false;
            if (current.moduleAssetsEnabled) {
              await setModuleAssetsEnabled(loaded.character, false);
            } else {
              value = await enableModuleAssets(loaded.character, loaded.chat);
              if (!value)
                await notifyUser(ITEMXText("ui-settings.035"), 'error');
            }
            loaded.moduleAssetsEnabled = value;
            uiState.status = value
              ? ITEMXText("ui-settings.034")
              : current.moduleAssetsEnabled
                ? ITEMXText("ui-settings.033")
                : ITEMXText("ui-settings.032");
            workQueue.remember('render', '');
            await updateRootSwitch('.x-risu-itemx2-setting-module-assets', value);
          })
      },
      ...[
        ['small', ITEMXText("ui-settings.031")],
        ['medium', ITEMXText("ui-settings.030")],
        ['large', ITEMXText("ui-settings.029")]
      ].map(([value, label]) => ({
        hook: `itemx2-setting-font-${value}`,
        run: () =>
          applyRootSetting(async () => {
            const loaded = await cachedOrRebuildCurrent();
            if (!loaded) return;
            await setFontScale(loaded.character, value);
            loaded.fontScale = value;
            uiState.status = ITEMXText("ui-settings.028", label);
            for (const scale of ['small', 'medium', 'large']) {
              const button = await queryMainClass(`itemx2-setting-font-${scale}`);
              if (!button) continue;
              if (scale === value) await button.addClass('x-risu-itemx2-font-on');
              else await button.removeClass('x-risu-itemx2-font-on');
            }
          })
      })),
      {
        hook: 'itemx2-setting-storage-cleanup',
        run: armed(
          'storageCleanupArmedUntil',
          async () => {
            uiState.status = ITEMXText("ui-settings.027");
            await showRootFeedback(
              ITEMXText("ui-settings.026"),
              'working',
              6500
            );
          },
          async () => {
            uiState.status = ITEMXText("ui-settings.025");
            await showRootFeedback(ITEMXText("ui-settings.024"), 'working', 0);
            try {
              const result = await compactCurrentChatStorage();
              await showRootFeedback(
                ITEMXText("ui-settings.023", Math.round(result.savedBytes / 1024), result.legacyKeysRemoved),
                'success',
                4200
              );
              if (result.loaded) await openRootInventory({ open: true, tab: 'settings', loaded: result.loaded });
            } catch (error) {
              uiState.storageCleanupArmedUntil = 0;
              uiState.status = ITEMXText("ui-settings.022");
              await showRootFeedback(ITEMXText("ui-settings.021", error.message || error), 'error', 4200);
              await notifyUser(ITEMXText("ui-settings.020", error.message || error), 'error');
            }
          }
        )
      },
      {
        hook: 'itemx2-setting-cleanup',
        run: armed(
          'cleanupArmedUntil',
          async () => {
            uiState.status = ITEMXText("ui-settings.019");
            await showRootFeedback(
              ITEMXText("ui-settings.018"),
              'error',
              6500
            );
          },
          async () => {
            uiState.status = ITEMXText("ui-settings.017");
            await showRootFeedback(ITEMXText("ui-settings.016"), 'working', 0);
            try {
              const result = await cleanCurrentChatItemx();
              await showRootFeedback(
                ITEMXText("ui-settings.015", result.cleanedMessages, result.removedMarkers),
                'success',
                3600
              );
              if (result.loaded) await openRootInventory({ open: true, tab: 'settings', loaded: result.loaded });
            } catch (error) {
              uiState.cleanupArmedUntil = 0;
              uiState.status = ITEMXText("ui-settings.014");
              await showRootFeedback(ITEMXText("ui-settings.013", error.message || error), 'error', 4200);
              await notifyUser(ITEMXText("ui-settings.012", error.message || error), 'error');
            }
          }
        )
      },
      {
        hook: 'itemx2-setting-rebuild',
        run: async () => {
          pipelineState.cachedLoaded = null;
          const loaded = await rebuildCurrent();
          if (loaded) await openRootInventory({ open: true, tab: 'settings', loaded });
        }
      }
    ];
  }

  async function toggleCurrentBot() {
    const ctx = await context();
    if (!ctx) return;
    const next = !(await isEnabled(ctx.character));
    await setEnabled(ctx.character, next);
    uiState.status = next ? ITEMXText("ui-settings.011") : ITEMXText("ui-settings.010");
    await openRootInventory({ open: true, tab: 'settings' });
  }

  async function openSettingsFromRisuMenu() {
    const active = await context();
    if (!active) {
      uiState.allowDrawerOverSettings = false;
      invalidateHostSettingsVisibility();
      uiState.status = ITEMXText("ui-settings.009");
      const message = ITEMXText("ui-settings.008");
      await notifyUser(message, 'error');
      return;
    }
    pipelineState.activeContextKey = active.key;
    uiState.allowDrawerOverSettings = true;
    invalidateHostSettingsVisibility();
    let styled = Boolean(hostState.mainDoc) || (await installMainStyle());
    const loadingStarted = styled ? Date.now() : 0;
    if (styled) await mountRootLoading(ITEMXText("ui-settings.007"));
    await updateRootLoading(ITEMXText("ui-settings.006"));
    const connected = await installPipelineHooks({ prompt: true });
    if (!styled) {
      await delay(300);
      styled = await installMainStyle();
      if (styled) await mountRootLoading(ITEMXText("ui-settings.005"));
    }
    await updateRootLoading(ITEMXText("ui-settings.004"));
    uiState.status = connected && styled ? ITEMXText("ui-settings.003") : connected ? ITEMXText("ui-settings.002") : ITEMXText("ui-settings.001");
    if (loadingStarted) await delay(Math.max(0, 260 - (Date.now() - loadingStarted)));
    if (styled) await openRootInventory({ open: true, tab: 'settings' });
    else await openInventory('settings');
  }
