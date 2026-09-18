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
        '업데이트 확인 시간이 초과되었습니다'
      );
      if (!response?.ok) throw new Error(`업데이트 서버 응답 ${response?.status || '없음'}`);
      const header = String((await response.text()) || '');
      const latest = header.match(/^\/\/@version\s+([^\s]+)\s*$/m)?.[1] || '';
      if (!latest) throw new Error('업데이트 버전 헤더를 찾지 못했습니다');
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
    if ('effectsEnabled' in patch) presentationState.visualEffectsEnabled = Boolean(patch.effectsEnabled);
    if ('skin' in patch) presentationState.visualSkin = SKIN_MODES.includes(patch.skin) ? patch.skin : 'dark';
  }

  async function outputSettings(character, { refresh = false } = {}) {
    const id = settingsId(character);
    if (!refresh && settingsState.settingsCache.has(id)) return { ...settingsState.settingsCache.get(id) };
    const document = await ITEMXSettings.read(Risuai.pluginStorage);
    const settings = ITEMXSettings.normalize(document.characters[id]);
    settingsState.settingsCache.set(id, settings);
    presentationState.visualEffectsEnabled = settings.effectsEnabled;
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

  async function setEffectsEnabled(character, value) {
    await writeSetting(character, 'effectsEnabled', Boolean(value));
    updateCachedSettings(character, { effectsEnabled: Boolean(value) });
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

  const AUX_LABELS = { off: '끔', missing: '누락 시', always: '항상 검토' };

  const RARITY_MODE_LABELS = { world: '세계관 우선', itemx: 'ITEMX 강제' };

  async function loadBadgePosition() {
    const saved = (await ITEMXSettings.read(Risuai.pluginStorage)).global.badgePosition;
    if (BADGE_POSITIONS.some(([value]) => value === saved)) uiState.badgePosition = saved;
  }

  function backupSettingsHtml(native) {
    return setCard(
      '백업 · 채팅 이사',
      '아이템·스킬·조우와 기록 목록을 저장하고 새 채팅으로 가져옵니다.',
      `<button class="itemx2-root-setting-button itemx2-setting-backup" data-action="backup" type="button">저장 / 불러오기</button>`
    );
  }

  async function openBackupPanel() {
    if (uiState.backupOpen) return;
    const ctx = await context();
    if (!ctx) throw new Error('현재 채팅을 찾을 수 없습니다.');
    uiState.backupOpen = true;
    let preview = null,
      url = '',
      busy = false;
    document.body.innerHTML = `<main id="itemx-backup"><header><h2>백업 · 채팅 이사</h2><button id="ix-close" type="button">닫기</button></header><p id="ix-target"></p><p>아이템·스킬·조우의 현재 상태와 기록 목록을 옮깁니다. 대화 본문·손요약·다른 모듈의 호감도/위치 변수·이미지 파일은 포함하지 않습니다. 초상은 같은 캐릭터/모듈 에셋이 있어야 표시됩니다.</p><section><h3>1. 지금 기록 저장</h3><button id="ix-export" type="button">백업 만들기</button><a id="ix-download" hidden>JSON 파일 저장</a><button id="ix-copy" type="button" disabled>텍스트 복사</button><textarea id="ix-export-text" aria-label="내보낸 백업" readonly placeholder="백업을 만들면 파일 저장 또는 텍스트 복사를 선택할 수 있습니다."></textarea></section><section><h3>2. 백업 불러오기</h3><label>불러오기 방식 <select id="ix-mode"><option value="empty">빈 채팅에 불러오기</option><option value="replace">기존 ITEMX 기록 덮어쓰기</option></select></label><p>덮어쓰기는 현재 ITEMX 기록을 백업 상태로 교체하고 기존 본문 카드를 제거합니다. 대화 글과 다른 모듈 데이터는 유지됩니다. 필요하면 먼저 현재 기록을 백업하세요.</p><label>백업 JSON 파일 <input id="ix-file" type="file" accept=".json,application/json"></label><textarea id="ix-import-text" aria-label="불러올 백업" placeholder="파일을 선택하거나 백업 텍스트를 붙여넣으세요."></textarea><button id="ix-preview" type="button">내용 확인</button><p id="ix-preview-text"></p><button id="ix-import" type="button" disabled>이 채팅에 불러오기</button></section><p id="ix-status" role="status" aria-live="polite"></p></main>`;
    const style = document.createElement('style');
    style.textContent =
      'body{margin:0;background:#0c121c;color:#e4eaf4;font:15px/1.6 system-ui}#itemx-backup{max-width:680px;margin:auto;padding:20px;box-sizing:border-box}#itemx-backup header{display:flex;align-items:center;justify-content:space-between;gap:12px}#itemx-backup section{padding:16px;margin:16px 0;border:1px solid #33435d;border-radius:12px}#itemx-backup button,#itemx-backup a{display:inline-block;padding:10px;margin:4px;border:1px solid #536884;border-radius:8px;background:#1a2940;color:#eef3fc;font:inherit;cursor:pointer}#itemx-backup [hidden]{display:none}#itemx-backup button:disabled{opacity:.45;cursor:default}#itemx-backup textarea{display:block;box-sizing:border-box;width:100%;min-height:105px;margin:12px 0;padding:10px;background:#090e17;color:#d9e6fc;border:1px solid #40516c;border-radius:8px}#itemx-backup input,#itemx-backup select{max-width:100%}#itemx-backup select{padding:8px;background:#1a2940;color:#eef3fc;border:1px solid #536884;border-radius:8px}#itemx-backup p{overflow-wrap:anywhere}#ix-status{padding:10px;background:#142137}';
    document.head.appendChild(style);
    const get = (id) => document.getElementById(id);
    get('ix-target').textContent = `현재 대상: ${ctx.character.name || '캐릭터'} · ${ctx.chat.name || '현재 채팅'}`;
    const status = (text) => {
      get('ix-status').textContent = text;
    };
    const countText = (value) => {
      const [i, s, m] = ITEMXBackup.counts(value);
      return `아이템 ${i} · 스킬 ${s} · 조우 ${m}`;
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
          status(`${countText(value)} · 백업 준비 완료. 파일 저장이나 텍스트 복사를 눌러 보관하세요.`);
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
            status('백업 텍스트를 복사했습니다.');
          } catch {
            status('백업 텍스트를 선택했습니다. 기기의 복사 메뉴로 복사해 주세요.');
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
        if (file.size > ITEMXBackup.MAX_BYTES) throw new Error('백업 파일은 32 MiB 이하여야 합니다.');
        get('ix-import-text').value = await file.text();
        status('파일을 읽었습니다. 내용을 확인해 주세요.');
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
            throw new Error('백업 텍스트가 변경되었습니다. 내용을 다시 확인해 주세요.');
          preview = prepared;
          get('ix-preview-text').textContent =
            `${preview.value.source} · ${preview.value.createdAt} · ${countText(preview.value)}${mode === 'replace' ? ` · 교체 대상: 아이템 ${preview.previousCounts[0]} · 스킬 ${preview.previousCounts[1]} · 조우 ${preview.previousCounts[2]}` : ''}`;
          get('ix-import').textContent = mode === 'replace' ? '기존 기록을 백업으로 덮어쓰기' : '이 채팅에 불러오기';
          get('ix-import').disabled = false;
          status('위 기록을 현재 채팅으로 가져옵니다. 확인 후 불러오기를 누르세요.');
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
          status(`${countText(value)} · 불러오기 완료. 닫은 뒤 CODEX에서 확인하세요.`);
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
          'Risu 연결',
          '모델 응답을 읽고 화면에 카드를 그리려면 Risu의 허가가 필요합니다. 처음 한 번만 물어봅니다.',
          setButton(
            skin,
            'connect',
            workQueue.isActive('connect') ? '확인 중…' : connection.ready ? '다시 확인' : '연결하기',
            ` itemx2-root-setting-button-primary${workQueue.isActive('connect') ? ' itemx2-root-setting-button-busy' : ''}`
          )
        ).replace('</small>', `</small><span class="itemx2-status-row">${parts.chips}</span>`)
      : // The fallback exists because main-document access was refused, so it
        // offers the two repair actions the drawer never has to show.
        setCard(
          '모델 처리 권한',
          `${parts.permissionLabel} · 모델 응답을 읽고 원시 태그를 정리하려면 필요합니다.`,
          setButton(skin, 'permissions', '권한 요청')
        ) +
        setCard(
          '본문 카드 스타일',
          `${parts.styleLabel} · 거부되어도 메시지별 스타일로 표시합니다.`,
          setButton(skin, 'style', '다시 연결')
        );
    return `<div class="itemx2-root-settings"><h4 class="itemx2-set-group">연결</h4>${connectionCards}${setCard(
      '보조 모델 상태',
      ITEMXCore.esc(auxStatusText()),
      `<button class="itemx2-root-setting-button${skin.hook('aux-run')}" type="button"${skin.data('aux-run')} ${auxState.auxActive > 0 ? 'disabled' : ''}>${auxState.auxActive > 0 ? '처리 중…' : '지금 검사'}</button>`,
      ' class="itemx2-aux-setting-status"'
    )}<h4 class="itemx2-set-group">기록</h4>${setCard(
      '무엇을 기록할까요',
      '끄면 새로 모으지 않을 뿐, 이미 쌓인 기록은 그대로 남습니다.'
    )}<div class="itemx2-domain-grid">${parts.domainControls}</div>${setCard(
      '이 봇에서 사용',
      enabled ? '활성 상태입니다.' : '끄면 이 봇에서만 멈춥니다. 다른 봇은 영향받지 않습니다.',
      setSwitch(skin, 'toggle', enabled)
    )}${setCard(
      '메인 모델에 형식 알리기',
      '대화 중인 모델에게 기록 규약을 전달합니다. 끄면 새 기록이 만들어지지 않습니다.',
      setSwitch(skin, 'main-output', loaded.mainOutput)
    )}${setCard(
      '보조 모델로 보완',
      '메인 모델이 형식을 놓쳤을 때 대신 확인합니다. Risu 설정에서 <b>기타 보조모델</b>을 먼저 지정해야 동작합니다.',
      setSegment(skin, 'aux', Object.entries(AUX_LABELS), loaded.auxOutput)
    )}${setCard(
      '등급 판정 기준',
      '세계관 등급명(초월급 등)은 그대로 두고, 색과 이펙트에 쓸 내부 등급만 정합니다.',
      setSegment(skin, 'rarity', Object.entries(RARITY_MODE_LABELS), loaded.rarityMode)
    )}${setCard(
      '로어북에서 설명 채우기',
      '이미 만난 상대만 로어북과 대조합니다. 모델을 부르지 않아 토큰이 들지 않습니다.',
      `<span class="itemx2-manager-actions">${setSwitch(skin, 'lorebook-toggle', loaded.lorebookEncounterEnabled)}${setButton(skin, 'lorebook-scan', '지금 스캔')}</span>`
    )}${setCard(
      '모듈 초상화 사용',
      '활성 모듈에서 이름이 맞는 캐릭터 이미지를 찾아 조우 도감에 씁니다. 못 찾으면 이모지로 대신합니다.',
      setSwitch(skin, 'module-assets', loaded.moduleAssetsEnabled)
    )}<h4 class="itemx2-set-group">모양</h4>${setCard(
      '화면 스킨',
      '서리는 밝은 중립 톤, 한지는 밝은 문서 톤입니다. 카드·인벤토리·도감·설정에 함께 적용됩니다.',
      setSegment(
        skin,
        'skin',
        SKIN_MODES.map((mode) => [mode, SKIN_LABELS[mode]]),
        loaded.skin || 'dark'
      )
    )}${setCard(
      '이펙트',
      '카드의 불꽃·서리 같은 장식입니다. 끄면 스크롤이 가벼워집니다.',
      setSwitch(skin, 'effects', loaded.effectsEnabled)
    )}${setCard('글자 크기', '인벤토리·도감의 본문 글자에 바로 적용됩니다.')}<div class="itemx2-font-grid">${parts.fontChoices}</div>${setCard(
      '배지 위치',
      '화면에서 CODEX 배지가 붙을 자리입니다.'
    )}<div class="itemx2-position-grid">${parts.positionChoices}</div>${parts.manager}<h4 class="itemx2-set-group">데이터</h4>${backupSettingsHtml(skin.native)}${setCard(
      '저장 공간',
      `${parts.footprintLabel} · 최근 원장은 자동 순환됩니다.`,
      `<span class="itemx2-manager-actions">${setButton(skin, 'rebuild', '재구축')}${setButton(skin, 'storage-cleanup', parts.storageCleanupArmed ? '다시 눌러 최적화' : '저장소 최적화', parts.storageCleanupArmed ? ' itemx2-setting-cleanup-armed' : '')}</span>`
    )}<div class="itemx2-danger-zone"><h4>되돌릴 수 없는 작업</h4>${setCard(
      '이 채팅의 ITEMX 기록 지우기',
      '본문의 카드와 원장을 모두 삭제하고 이 봇을 OFF로 바꿉니다. 대화 글은 남습니다. 복구할 수 없으니 필요하면 먼저 백업하세요.',
      setButton(
        skin,
        'cleanup-chat',
        parts.cleanupArmed ? '다시 눌러 완전 제거' : '현재 채팅 정리',
        parts.cleanupArmed ? ' itemx2-setting-cleanup-armed' : ''
      )
    )}</div>${parts.debugPanel}${setCard('플러그인', `ITEMX CODEX ${ITEMX_PLUGIN_VERSION}`)}</div>`;
  }

  function settingsDomainControls(loaded, skin) {
    return [
      ['items', '무기·아이템', loaded.itemsEnabled, '감정·손상·소실'],
      ['skills', '스킬', loaded.skillsEnabled, '습득·숙련·봉인'],
      ['encounters', '전투 도감', loaded.encountersEnabled, '적대·대련·전투']
    ]
      .map(
        ([key, label, value, note]) =>
          `<button class="itemx2-domain-card${skin.hook(`domain-${key}`)} ${value ? 'itemx2-setting-on' : ''}" type="button"${skin.data(`domain-${key}`)}><strong>${label}</strong><small>${note}</small><i>${value ? '기록 중' : '멈춤'}</i></button>`
      )
      .join('');
  }

  function settingsFontChoices(loaded, skin) {
    return [
      ['small', '작게'],
      ['medium', '보통'],
      ['large', '크게']
    ]
      .map(
        ([value, label]) =>
          `<button class="itemx2-font-choice itemx2-setting-font-${value} ${loaded.fontScale === value ? 'itemx2-font-on' : ''}" type="button"${skin.choiceData('font', value)}><em>가나다</em><span>${label}</span></button>`
      )
      .join('');
  }

  function settingsPositionChoices(skin) {
    const positionLabel = (BADGE_POSITIONS.find(([key]) => key === uiState.badgePosition) || BADGE_POSITIONS[0])[1];
    // A map of the screen beats six abbreviations: the slot sits where the badge will.
    return `<div class="itemx2-position-map">${BADGE_POSITIONS.map(
      ([key, label]) =>
        `<button class="itemx2-position-choice itemx2-position-${key} ${uiState.badgePosition === key ? 'itemx2-position-on' : ''}" type="button"${skin.choiceData('position', key)} aria-label="${label}"></button>`
    ).join(
      ''
    )}<span class="itemx2-position-screen">대화 화면</span></div><p class="itemx2-position-hint">현재 <b>${positionLabel}</b> · 고르면 배지와 패널이 바로 옮겨집니다.</p>`;
  }

  function settingsStorageParts(loaded) {
    const footprint = itemxStorageFootprint(loaded.chat);
    return {
      cleanupArmed: uiState.cleanupArmedUntil > Date.now(),
      storageCleanupArmed: uiState.storageCleanupArmedUntil > Date.now(),
      footprintLabel: `${Math.max(1, Math.ceil(footprint.totalBytes / 1024))} KiB · 마커 ${footprint.markerCount}개`
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
        .join('\n\n') || '기록 없음'
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
          await openRootInventory({ open: true, tab: 'settings', loaded });
        })
    });
    const armed = (key, arm, confirmed) => async () => {
      if (runtime[key] <= Date.now()) {
        runtime[key] = Date.now() + 7000;
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
          uiState.status = '연결 및 권한 확인 중';
          await updateConnectionUi();
          await showRootFeedback('ITEMX CODEX 연결과 권한을 확인하는 중입니다…', 'working', 0);
          try {
            const connected = await installPipelineHooks({ prompt: true });
            const styled = await installMainStyle();
            uiState.status =
              connected && styled ? '연결 및 권한 정상' : connected ? '화면 연결 실패' : '모델 훅 연결 실패';
            if (connected && styled) {
              await showRootFeedback('ITEMX CODEX 연결 및 권한 확인 완료', 'success');
            } else {
              await showRootFeedback(
                `연결 확인 실패 · ${(!connected ? hostState.lastHookError : hostState.lastDomError) || uiState.status}`,
                'error',
                3600
              );
            }
            if (!connected || !styled)
              await notifyUser(
                `ITEMX CODEX 연결 확인 실패: ${(!connected ? hostState.lastHookError : hostState.lastDomError) || uiState.status}`,
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
          uiState.status = '보조 모델 수동 검사 중';
          await recoverAuxiliaryOutput({ force: true });
        }
      },
      ...BADGE_POSITIONS.map(([key, label]) => ({
        hook: `itemx2-position-${key}`,
        run: async () => {
          uiState.badgePosition = key;
          await ITEMXSettings.update(Risuai.pluginStorage, null, { badgePosition: key });
          uiState.status = `배지 위치 · ${label}`;
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
        run: () =>
          applyRootSetting(async () => {
            const loaded = await rebuildCurrent();
            if (!loaded) return;
            const next = !(await isEnabled(loaded.character));
            await setEnabled(loaded.character, next);
            uiState.status = next ? '현재 봇 활성화' : '현재 봇 비활성화';
            await updateRootSettingButton('.x-risu-itemx2-setting-toggle', next ? 'ON' : 'OFF', next);
          })
      },
      ...[
        ['items', 'itemsEnabled', '무기·아이템'],
        ['skills', 'skillsEnabled', '스킬'],
        ['encounters', 'encountersEnabled', '전투 도감']
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
            await openRootInventory({ open: true, tab: 'settings' });
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
            uiState.status = `디버그 로그 · ${value ? 'ON' : 'OFF'}`;
            await openRootInventory({ open: true, tab: 'settings' });
          })
      },
      {
        hook: 'itemx2-setting-debug-clear',
        run: async () => {
          settingsState.debugEntries = [];
          uiState.status = '디버그 로그 비움';
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
            uiState.status = `메인 출력 · ${value ? 'ON' : 'OFF'}`;
            await updateRootSettingButton('.x-risu-itemx2-setting-main', value ? 'ON' : 'OFF', value);
          })
      },
      // Multi-choice settings render every option, so one row per option.
      ...[
        [
          'aux',
          Object.keys(AUX_LABELS),
          async (loaded, value) => {
            await setAuxOutput(loaded.character, value);
            uiState.status = `보조 모델로 보완 · ${AUX_LABELS[value]}`;
          }
        ],
        [
          'rarity',
          Object.keys(RARITY_MODE_LABELS),
          async (loaded, value) => {
            await setRarityMode(loaded.character, value);
            uiState.status = `등급 판정 기준 · ${RARITY_MODE_LABELS[value]}`;
          }
        ],
        [
          'skin',
          SKIN_MODES,
          async (loaded, value) => {
            await setSkin(loaded.character, value);
            loaded.skin = value;
            uiState.status = `화면 스킨 · ${SKIN_LABELS[value]}`;
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
              await openRootInventory({ open: true, tab: 'settings', loaded });
            })
        }))
      ),
      toggleSetting(
        'itemx2-setting-effects',
        (current) => current.effectsEnabled,
        async (loaded, value) => {
          await setEffectsEnabled(loaded.character, value);
          loaded.effectsEnabled = value;
        },
        '시각 이펙트'
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
            uiState.status = `조우 로어북 자동 보완 · ${value ? 'ON' : 'OFF'}`;
            if (value) await scanLorebookEncounters({ refresh: true, silent: true });
            await openRootInventory({ open: true, tab: 'settings' });
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
                await notifyUser('모듈 에셋 권한이 허용되지 않았습니다. 조우 초상화는 이모지로 표시됩니다.', 'error');
            }
            loaded.moduleAssetsEnabled = value;
            uiState.status = value
              ? '모듈 에셋 초상화 · ON'
              : current.moduleAssetsEnabled
                ? '모듈 에셋 초상화 · OFF'
                : '모듈 에셋 권한 없음 · 이모지 폴백';
            workQueue.remember('render', '');
            await openRootInventory({ open: true, tab: 'settings', loaded });
          })
      },
      ...[
        ['small', '소'],
        ['medium', '중'],
        ['large', '대']
      ].map(([value, label]) => ({
        hook: `itemx2-setting-font-${value}`,
        run: () =>
          applyRootSetting(async () => {
            const loaded = await cachedOrRebuildCurrent();
            if (!loaded) return;
            await setFontScale(loaded.character, value);
            loaded.fontScale = value;
            uiState.status = `글자 크기 · ${label}`;
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
            uiState.status = '최적화 확인 대기 · 7초 안에 다시 누르세요';
            await showRootFeedback(
              '현재 상태는 보존하고 오래된 ITEMX 표시 마커와 원장만 순환 저장소로 접습니다.',
              'working',
              6500
            );
          },
          async () => {
            uiState.status = '현재 채팅 저장소 최적화 중';
            await showRootFeedback('현재 상태를 보존하며 과거 이벤트 기록을 정리하는 중입니다…', 'working', 0);
            try {
              const result = await compactCurrentChatStorage();
              await showRootFeedback(
                `최적화 완료 · ${Math.round(result.savedBytes / 1024)} KiB 절감 · 구형 캐시 ${result.legacyKeysRemoved}개 정리`,
                'success',
                4200
              );
              if (result.loaded) await openRootInventory({ open: true, tab: 'settings', loaded: result.loaded });
            } catch (error) {
              uiState.storageCleanupArmedUntil = 0;
              uiState.status = '저장소 최적화 실패';
              await showRootFeedback(`최적화 실패 · ${error.message || error}`, 'error', 4200);
              await notifyUser(`ITEMX CODEX 저장소 최적화 실패: ${error.message || error}`, 'error');
            }
          }
        )
      },
      {
        hook: 'itemx2-setting-cleanup',
        run: armed(
          'cleanupArmedUntil',
          async () => {
            uiState.status = '정리 확인 대기 · 7초 안에 다시 누르세요';
            await showRootFeedback(
              '되돌릴 수 없습니다. 7초 안에 정리 버튼을 다시 누르면 현재 봇을 끄고 이 채팅 기록만 지웁니다.',
              'error',
              6500
            );
          },
          async () => {
            uiState.status = '현재 채팅 ITEMX 기록 정리 중';
            await showRootFeedback('현재 채팅의 ITEMX 마커와 저장 원장을 정리하는 중입니다…', 'working', 0);
            try {
              const result = await cleanCurrentChatItemx();
              await showRootFeedback(
                `정리 완료 · 본문 ${result.cleanedMessages}개 · 마커 ${result.removedMarkers}개`,
                'success',
                3600
              );
              if (result.loaded) await openRootInventory({ open: true, tab: 'settings', loaded: result.loaded });
            } catch (error) {
              uiState.cleanupArmedUntil = 0;
              uiState.status = '현재 채팅 정리 실패';
              await showRootFeedback(`정리 실패 · ${error.message || error}`, 'error', 4200);
              await notifyUser(`ITEMX CODEX 정리 실패: ${error.message || error}`, 'error');
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
    uiState.status = next ? '현재 봇 활성화' : '현재 봇 비활성화';
    await openRootInventory({ open: true, tab: 'settings' });
  }

  async function openSettingsFromRisuMenu() {
    const active = await context();
    if (!active) {
      uiState.allowDrawerOverSettings = false;
      invalidateHostSettingsVisibility();
      uiState.status = '채팅 진입 대기';
      const message = 'ITEMX CODEX는 채팅봇에 진입한 뒤 사용할 수 있습니다.';
      await notifyUser(message, 'error');
      return;
    }
    pipelineState.activeContextKey = active.key;
    uiState.allowDrawerOverSettings = true;
    invalidateHostSettingsVisibility();
    let styled = Boolean(hostState.mainDoc) || (await installMainStyle());
    const loadingStarted = styled ? Date.now() : 0;
    if (styled) await mountRootLoading('ITEMX CODEX 설정 불러오는 중…');
    await updateRootLoading('연결과 권한 확인 중…');
    const connected = await installPipelineHooks({ prompt: true });
    if (!styled) {
      await delay(300);
      styled = await installMainStyle();
      if (styled) await mountRootLoading('ITEMX CODEX 설정 불러오는 중…');
    }
    await updateRootLoading('인벤토리 상태 확인 중…');
    uiState.status = connected && styled ? '연결 및 권한 정상' : connected ? '화면 연결 실패' : '모델 훅 연결 실패';
    if (loadingStarted) await delay(Math.max(0, 260 - (Date.now() - loadingStarted)));
    if (styled) await openRootInventory({ open: true, tab: 'settings' });
    else await openInventory('settings');
  }
