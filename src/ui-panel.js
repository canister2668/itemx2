/* ITEMX ui panel owner. Concatenated inside the runtime closure. */
  function itemsOf(snapshot) {
    const reg = snapshot?.registry || ITEMXCore.newRegistry();
    return reg.order.map((id) => reg.items[id]).filter(Boolean);
  }

  function rootPageItems(loaded) {
    const all = itemsOf(loaded?.snapshot)
      .filter((item) => !ITEMXHistory.terminal('item', item))
      .slice(0, 60);
    const pageCount = Math.max(1, Math.ceil(all.length / ITEMX_ROOT_PAGE_SIZE));
    uiState.rootItemPage = Math.max(0, Math.min(pageCount - 1, uiState.rootItemPage));
    const start = uiState.rootItemPage * ITEMX_ROOT_PAGE_SIZE;
    return all.slice(start, start + ITEMX_ROOT_PAGE_SIZE);
  }

  function presentationRecord(domain, id) {
    if (!presentationState.presentationRecords) {
      const records = new Map(),
        chat = pipelineState.cachedLoaded?.chat;
      const manual = [...(readReplayBaseline(chat)?.manual || []), ...manualLedger(chat)];
      const manualByIndex = new Map();
      for (const row of manual) {
        const index = Math.min(Math.max(-1, row.afterIndex), (chat?.message?.length || 0) - 1);
        const rows = manualByIndex.get(index) || [];
        rows.push(row);
        manualByIndex.set(index, rows);
      }
      const put = (payload, domain, index) => {
        const id = payload.view?.id || payload.event?.item?.id || payload.event?.patch?.id;
        if (id) {
          const prior = records.get(`${domain}:${id}`),
            review = { ...payload.review };
          if (prior?.review?.missing?.length && !payload.review?.checked && payload.review?.source !== 'manual') {
            review.missing = prior.review.missing;
            review.evidenceIndex = prior.review.evidenceIndex ?? prior.messageIndex;
          }
          if (payload.review?.source === 'manual') {
            review.missing = [];
            review.checked = false;
          }
          records.set(`${domain}:${id}`, { ...payload, review, messageIndex: index });
        }
      };
      const putManual = (index) => {
        for (const row of manualByIndex.get(index) || [])
          put(
            { ...row.presentation, event: row.event, review: row.presentation?.review || { source: 'manual' } },
            'item',
            index
          );
      };
      putManual(-1);
      for (let index = 0; index < (chat?.message?.length || 0); index++) {
        for (const row of presentationPayloads(messageData(chat.message[index]))) put(row.payload, row.domain, index);
        putManual(index);
      }
      presentationState.presentationRecords = records;
    }
    return presentationState.presentationRecords.get(`${domain}:${id}`) || {};
  }

  function detailAnnotations(domain, entity) {
    const record = presentationRecord(domain, entity.id);
    const changes = ITEMXRenderer.changesHtml(record.previous, entity, domain);
    const review = ITEMXRenderer.reviewHtml(record.review, entity);
    const repair =
      domain === 'item' && record.review?.missing?.length
        ? `<button class="itemx2-repair-one" data-action="repair-one" data-item-id="${ITEMXCore.esc(entity.id)}">이 항목의 누락 정보만 보완</button>`
        : '';
    return `${changes}${review}${repair}`;
  }

  function itemDetailHtml(item) {
    const motion = presentationState.visualEffectsEnabled ? 'full' : 'off';
    const record = presentationRecord('item', item.id);
    const key = `${item.id}:${ITEMXCore.fnv1a(JSON.stringify([item, record.previous, record.review]))}:${motion}`;
    if (presentationState.detailHtmlCache.has(key)) return presentationState.detailHtmlCache.get(key);
    const html = `<div class="itemx2-detail-stack">${ITEMXRenderer.renderCard(item, { motion })}${detailAnnotations('item', item)}</div>`;
    presentationState.detailHtmlCache.set(key, html);
    while (presentationState.detailHtmlCache.size > 60)
      presentationState.detailHtmlCache.delete(presentationState.detailHtmlCache.keys().next().value);
    return html;
  }

  async function hydrateCheckedItemDetail(loaded) {
    if (!hostState.mainDoc || !loaded) return false;
    const detailItems = rootPageItems(loaded);
    for (let index = 0; index < detailItems.length; index += 1) {
      const selected = await hostState.mainDoc.querySelector(`#itemx2-detail-${index}:checked`);
      if (!selected) continue;
      const detail = await queryMainClass(`itemx2-root-detail-body-${index}`);
      if (detail) await detail.setInnerHTML(itemDetailHtml(detailItems[index]));
      return Boolean(detail);
    }
    return false;
  }

  function codexEntries(loaded, domain) {
    return ITEMXHistory.currentEntities(loaded, domain).slice(0, 60);
  }

  async function hydrateCheckedCodexDetail(domain, loaded) {
    if (!hostState.mainDoc || !loaded || !['skill', 'monster'].includes(domain)) return false;
    const marker = await hostState.mainDoc.querySelector(
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
    if (loaded.key !== pipelineState.activeContextKey) return false;
    const detailKey = codexDetailCacheKey(domain, entity, portrait, loaded.rarityMode);
    if (workQueue.revision('detail') === detailKey) return true;
    const detail = await queryMainClass(`itemx2-root-${domain}-detail-body-${index}`);
    if (!detail) return false;
    await detail.setInnerHTML(
      `<span class="itemx2-codex-detail-index">${index}</span>${rootCodexDetailHtml(domain, entity, portrait, loaded.rarityMode)}`
    );
    workQueue.remember('detail', detailKey);
    return true;
  }

  async function queryMainClass(className) {
    if (!hostState.mainDoc) return null;
    return (
      (await hostState.mainDoc.querySelector(`.x-risu-${className}`)) ||
      (await hostState.mainDoc.querySelector(`.${className}`))
    );
  }

  async function removeRootClickRouter() {
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

  async function removeRootDrawer() {
    uiState.historyView.open = false;
    workQueue.clearTimer('feedbackTimer');
    await removeRootClickRouter();
    try {
      if (uiState.rootDrawer) await uiState.rootDrawer.remove();
    } catch {}
    if (hostState.mainDoc) {
      try {
        const safeRoots = await hostState.mainDoc.querySelectorAll('[x-itemx2-drawer="owner"]');
        const roots = await Risuai.unwarpSafeArray(safeRoots);
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

  async function mountRootLoading(label = 'ITEMX CODEX 초기화 중…') {
    if (!hostState.mainDoc) return false;
    await removeRootDrawer();
    const root = await hostState.mainDoc.createElement('div');
    await root.setAttribute('x-itemx2-drawer', 'owner');
    await root.setClassName('x-risu-itemx2-root-drawer x-risu-itemx2-booting');
    await root.setInnerHTML(
      `<div class="itemx2-boot-card" role="status" aria-live="polite"><i></i><span><strong>${ITEMXCore.esc(label)}</strong><small>화면과 모델 연결을 준비하고 있습니다.</small></span></div>`
    );
    const body = await hostState.mainDoc.querySelector('body');
    if (!body) return false;
    await body.appendChild(root);
    uiState.rootDrawer = root;
    workQueue.forget('render');
    return true;
  }

  async function updateRootLoading(label) {
    if (!hostState.mainDoc || !uiState.rootDrawer) return;
    try {
      const target = await hostState.mainDoc.querySelector('.x-risu-itemx2-boot-card strong');
      if (target) await target.setTextContent(label);
    } catch (error) {
      fail('loading label', error);
    }
  }

  async function showRootFeedback(message, tone = 'success', timeoutMs = 2600) {
    if (!hostState.mainDoc || !uiState.rootDrawer) return false;
    try {
      const toast = await hostState.mainDoc.querySelector('.x-risu-itemx2-feedback');
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

  async function callOptionalRisuApi(name, ...args) {
    try {
      const method = Risuai[name];
      if (typeof method !== 'function') return { available: false, value: undefined };
      return { available: true, value: await method(...args) };
    } catch (error) {
      if (/API method\s+\S+\s+not found/i.test(String(error?.message || error || ''))) {
        return { available: false, value: undefined };
      }
      throw error;
    }
  }

  async function lorebookEntries(contextKey, { refresh = false } = {}) {
    if (
      !refresh &&
      pipelineState.lorebookCache.key === contextKey &&
      pipelineState.lorebookCache.at &&
      Date.now() - pipelineState.lorebookCache.at < 10000
    )
      return pipelineState.lorebookCache.rows;
    const response = await callOptionalRisuApi('getCurrentLorebookEntries');
    if (!response.available) {
      const error = new Error('현재 RisuAI에서 로어북 조회 API를 지원하지 않습니다.');
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
    pipelineState.lorebookCache = { key: contextKey, at: Date.now(), rows };
    return rows;
  }

  async function scanLorebookEncounters({ refresh = false, silent = false } = {}) {
    const pending = (async () => {
      const ctx = await context();
      if (!ctx) throw new Error('현재 채팅을 찾을 수 없습니다.');
      const entries = await lorebookEntries(ctx.key, { refresh });
      const active = await context();
      if (!active || active.key !== ctx.key) throw new Error('스캔 중 채팅이 바뀌었습니다. 다시 시도하세요.');
      const scanResult = await (async () => {
        const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
        if (!latest) throw new Error('현재 채팅을 다시 불러오지 못했습니다.');
        if (
          latest.isStreaming ||
          (latest.message || []).some((message) => message?.isStreaming || message?.bgContinue)
        ) {
          throw new Error('출력 스트리밍이 끝난 뒤 로어북을 스캔할 수 있습니다.');
        }
        const lookup = buildMessageEventLookup(latest);
        const base = rebuildCodexWithLedger(latest, lookup);
        const previous = ITEMXLorebook.read(latest);
        const sourceFingerprint = `${ctx.key}:${encounterRegistryFingerprint(base)}:${ITEMXCore.fnv1a(JSON.stringify(entries))}:${ITEMXCore.fnv1a(JSON.stringify(previous.rows))}`;
        if (!refresh && silent && workQueue.revision('lorebook') === sourceFingerprint)
          return { changed: false, sourceFingerprint, result: { enriched: 0, removed: 0, matched: 0, ambiguous: 0 } };
        const scanned = ITEMXLorebook.scan(base, entries, previous);
        if (!scanned.result.enriched && !scanned.result.removed)
          return { ...scanned, changed: false, sourceFingerprint };
        const next = ITEMXCore.clone(latest);
        next.scriptstate = { ...(next.scriptstate || {}), [ITEMX_LORE_KEY]: JSON.stringify(scanned.ledger) };
        await saveChat(ctx.characterIndex, ctx.chatIndex, next);
        return {
          ...scanned,
          changed: true,
          sourceFingerprint: `${ctx.key}:${encounterRegistryFingerprint(base)}:${ITEMXCore.fnv1a(JSON.stringify(entries))}:${ITEMXCore.fnv1a(JSON.stringify(scanned.ledger.rows))}`
        };
      })();
      const current = await context();
      if (hostState.unloading || current?.key !== ctx.key) return scanResult;
      if (scanResult.changed) {
        pipelineState.cachedLoaded = null;
        presentationState.detailHtmlCache.clear();
        workQueue.remember('render', '');
        pipelineState.generation += 1;
        await rebuildCurrent();
      }
      const summary = scanResult.result;
      workQueue.remember('lorebook', scanResult.sourceFingerprint);
      if (!silent || summary.enriched || summary.removed)
        uiState.status = `로어북 스캔 · 보완 ${summary.enriched} · 정리 ${summary.removed} · 일치 ${summary.matched} · 모호 ${summary.ambiguous}`;
      debugRecord('lorebook scan', summary);
      if (!silent)
        await notifyUser(
          `조우 로어북 스캔 완료 · 보완 ${summary.enriched}건 · 정리 ${summary.removed}건 · 일치 ${summary.matched}건${summary.ambiguous ? ` · 모호하여 제외 ${summary.ambiguous}건` : ''}`,
          'success'
        );
      return scanResult;
    })().catch(async (error) => {
      if (!silent) await notifyUser(`조우 로어북 스캔 실패: ${error.message || error}`, 'error');
      else debugRecord('automatic lorebook scan skipped', error?.message || String(error));
      return null;
    });
    return pending;
  }

  async function notifyUser(message, tone = 'error') {
    if (await showRootFeedback(message, tone, tone === 'error' ? 4200 : 2600)) return true;
    log(message);
    return false;
  }

  async function confirmUser(message) {
    try {
      if (typeof globalThis.confirm === 'function') return globalThis.confirm(message) === true;
    } catch (error) {
      fail('browser confirmation', error);
    }
    return false;
  }

  function scheduleHostDomSync(delayMs = 320) {
    workQueue.schedule('hostSyncTimer', async () => {
      try {
        await installBodyEffectGovernor();
        await ensureRootInventory();
        await syncHostSettingsVisibility();
        await flushEventBursts();
      } catch (error) {
        debugRecord('host DOM sync', error?.message || String(error));
      }
    }, delayMs, false, () => !presentationState.bodyFxScrollActive);
  }

  async function installHostObserver() {
    if (!hostState.mainDoc || hostState.hostObserver || typeof Risuai.createMutationObserver !== 'function') return;
    try {
      const body = await hostState.mainDoc.querySelector('body');
      if (!body) return;
      hostState.hostObserver = await Risuai.createMutationObserver(
        entry('host-observer', (recordsSafe) => {
          if (presentationState.bodyFxScrollActive) {
            scheduleHostDomSync();
            return;
          }
          return (async () => {
            try {
              const records = await Risuai.unwarpSafeArray(recordsSafe);
              if (!records.length) {
                scheduleHostDomSync();
                return;
              }
              for (const record of records) {
                const target = await record.getTarget();
                if (!target || !(await target.matches('[x-itemx2-drawer="owner"], [x-itemx2-drawer="owner"] *'))) {
                  scheduleHostDomSync();
                  return;
                }
              }
            } catch (error) {
              debugRecord('host observer classify', error?.message || String(error));
              scheduleHostDomSync();
            }
          })();
        })
      );
      if (!hostState.hostObserver?.observe) throw new Error('Mutation observer unavailable');
      await hostState.hostObserver.observe(body, { childList: true, subtree: true });
      armRemountWatchdog();
    } catch (error) {
      try {
        await hostState.hostObserver?.disconnect();
      } catch {}
      hostState.hostObserver = null;
      armRemountWatchdog();
      debugRecord('host observer install', error?.message || String(error));
    }
  }

  function invalidateHostSettingsVisibility() {
    hostState.hostSettingsCache.at = 0;
  }

  async function hostPluginSettingsVisible() {
    if (!hostState.mainDoc || uiState.allowDrawerOverSettings) return false;
    const now = Date.now();
    if (now - hostState.hostSettingsCache.at < 750) return hostState.hostSettingsCache.visible;
    try {
      const safeTargets = await hostState.mainDoc.querySelectorAll('button,[role="button"]');
      const targets = await Risuai.unwarpSafeArray(safeTargets);
      for (const target of targets.slice(0, 96)) {
        const text = String((await target.textContent()) || '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!text.includes('ITEMX CODEX · 권한 및 설정')) continue;
        const rect = await target.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          hostState.hostSettingsCache = { at: now, visible: true };
          return true;
        }
      }
    } catch (error) {
      fail('host settings visibility', error);
    }
    hostState.hostSettingsCache = { at: now, visible: false };
    return false;
  }

  async function syncHostSettingsVisibility() {
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

  async function setRootOpen(open) {
    if (!uiState.rootDrawer) return false;
    try {
      if (!(await uiState.rootDrawer.getParent())) {
        uiState.rootOpen = false;
        return false;
      }
      if (open) await uiState.rootDrawer.addClass('x-risu-itemx2-is-open');
      else {
        await uiState.rootDrawer.removeClass('x-risu-itemx2-is-open');
        uiState.rootOpen = false;
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

  async function resetRuntimeForContext(active) {
    const nextKey = active?.key || '';
    if (pipelineState.activeContextKey === nextKey) return false;
    pipelineState.activeContextKey = nextKey;
    portraitsState.inlinePortraitCatalog = null;
    uiState.historyView = { open: false, key: nextKey, domain: 'item', filter: 'recent', selected: null, page: 0 };
    clearEventBursts();
    armRemountWatchdog();
    uiState.rootItemPage = 0;
    workQueue.remember('detail', '');
    invalidateHostSettingsVisibility();
    pipelineState.cachedLoaded = null;
    workQueue.remember('loaded-generation', -1);
    workQueue.forget('uncommitted-markers');
    presentationState.markerHtmlCache.clear();
    presentationState.detailHtmlCache.clear();
    workQueue.forget('catch-up');
    workQueue.forget('aux-settle');
    workQueue.remember('lorebook', '');
    uiState.cleanupArmedUntil = 0;

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


    presentationState.bodyFxClassOwner = null;
    refreshLatest(active?.chat || { message: [], scriptstate: {} });
    await removeRootDrawer();
    return true;
  }

  function ensureRootInventory() {
    if (hostState.unloading || presentationState.bodyFxScrollActive) return Promise.resolve();
    return ensureRootInventoryNow();
  }

  async function ensureRootInventoryNow() {
    if (uiState.backupOpen) return;
    if (presentationState.bodyFxScrollActive) return;
    workQueue.remember('remount', 'checked');
    const active = await context();
    const contextChanged = await resetRuntimeForContext(active);
    if (!active) {
      uiState.status = '채팅 진입 대기';
      return;
    }
    const cached = pipelineState.cachedLoaded;
    const replayChanged =
      !contextChanged &&
      cached?.key === active.key &&
      cached.replayFingerprint !== replaySourceFingerprint(active.chat);

    if (!contextChanged && (auxState.auxActive > 0))
      return;

    try {
      if (!hostState.hooks.output || !hostState.hooks.display || !hostState.hooks.before || !hostState.hooks.after)
        await installPipelineHooks();
      if (contextChanged) {
        if (!hostState.mainDoc && !(await installMainStyle())) return;
        const loaded = await rebuildCurrent({ upgradeDisplayRefs: true });
        if (loaded) await openRootInventory({ open: false, loaded });
        void dispatch('update', checkForUpdate);
        return;
      }
      if (!hostState.mainDoc && !(await installMainStyle())) return;
      let drawerAttached = false;
      if (uiState.rootDrawer) {
        try {
          drawerAttached = Boolean(await uiState.rootDrawer.getParent());
        } catch {
          uiState.rootDrawer = null;
        }
      }
      if (!drawerAttached) {
        const safeMounted = await hostState.mainDoc.querySelectorAll('[x-itemx2-drawer="owner"]');
        const mounted = await Risuai.unwarpSafeArray(safeMounted);
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
      let styleAttached = false;
      if (hostState.mainStyle) {
        try {
          styleAttached = Boolean(await hostState.mainStyle.getParent());
        } catch {
          hostState.mainStyle = null;
        }
      }
      if (!styleAttached) {
        const style = await hostState.mainDoc.querySelector('style[x-itemx2-style="owner"]');
        if (style) hostState.mainStyle = style;
        else {
          hostState.mainStyle = null;
          await installMainStyle();
        }
      }
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

  const skillEmoji = (skill) => ITEMXCore.resolveSkillGlyph(skill);

  const encounterEmoji = (monster) => ITEMXCore.resolveMonsterGlyph(monster);

  const themeText = (value) =>
    String(value || '')
      .trim()
      .toLowerCase();

  function skillTheme(skill) {
    const value = themeText(`${skill.affinity || ''} ${skill.school || ''}`);
    if (/화염|불|fire|flame|ember/.test(value)) return 'fire';
    if (/빙|냉|서리|ice|frost|cold/.test(value)) return 'ice';
    if (/번개|뇌|전기|lightning|thunder|electric/.test(value)) return 'lightning';
    if (/암흑|어둠|그림자|dark|shadow|void/.test(value)) return 'dark';
    if (/빛|신성|광휘|light|holy|radiant/.test(value)) return 'light';
    return 'arcane';
  }

  function skillRankTier(rank, rarityMode = 'world') {
    const value = themeText(rank);
    const tiers = [
      ['empyrean', /empyrean|창천|천상|초월|금기|transcendent/],
      ['mythical', /mythical|신화|신공|현경|mythic/],
      ['legendary', /legendary|전설|화경/],
      ['epic', /epic|에픽|절기|초절정/],
      ['unique', /unique|유니크|비전|절정|영웅/],
      ['rare', /rare|레어|희귀|상급|고급|일류/],
      ['magic', /magic|매직|비범|중급|숙련|이류/],
      ['normal', /normal|common|일반|기초|초급|하급|삼류/]
    ];
    const matched = tiers.find(([, pattern]) => pattern.test(value));
    if (matched) return matched[0];
    return rarityMode === 'itemx' ? 'normal' : 'magic';
  }

  function skillFxClasses(skill, rarityMode = 'world') {
    const type = ['active', 'passive', 'sealed'].includes(themeText(skill.type)) ? themeText(skill.type) : 'active';
    const status = ['learned', 'equipped', 'sealed', 'lost'].includes(themeText(skill.status))
      ? themeText(skill.status)
      : 'learned';
    const tier = skillRankTier(skill.rank, rarityMode);
    return `itemx2-skill-theme-${skillTheme(skill)} itemx2-skill-rank-${tier} rarity-${tier} itemx2-skill-type-${type} itemx2-skill-status-${status}`;
  }

  function encounterTheme(monster) {
    const value = themeText(monster.kind);
    if (/용|dragon|drake|wyrm/.test(value)) return 'dragon';
    if (/언데드|망령|유령|좀비|undead|ghost|specter|zombie/.test(value)) return 'undead';
    if (/골렘|기계|인형|구조체|construct|golem|machine|automaton/.test(value)) return 'construct';
    if (/수생|어류|해양|aquatic|fish|marine|serpent/.test(value)) return 'aquatic';
    if (/곤충|벌레|insect|bug|arachnid|spider/.test(value)) return 'insect';
    if (/야수|짐승|동물|beast|animal|wolf|tiger/.test(value)) return 'beast';
    if (/인간|인물|사람|전사|기사|마법사|human|humanoid|person|warrior|knight|mage/.test(value)) return 'humanoid';
    return 'unknown';
  }

  function encounterThreatLevel(value) {
    const text = themeText(value);
    if (/최상|극위험|재앙|catastrophic|extreme|sss|\bss\b/.test(text)) return 3;
    if (/고위험|위험|high|dangerous/.test(text)) return 2;
    if (/중간|중위험|medium|moderate/.test(text)) return 1;
    return 0;
  }

  function encounterFxClasses(monster) {
    const relation = themeText(monster.relation),
      status = themeText(monster.status);
    const warning = monster.active || /hostile|적대|enemy|전투/.test(relation) ? 'itemx2-encounter-warning' : '';
    const sparring = /대련|spar|rival|friendly/.test(relation) ? 'itemx2-encounter-sparring' : '';
    const ended = /ended|defeated|escaped|dead|lost|종료|격퇴|패배|도주|사망|소실/.test(status)
      ? 'itemx2-encounter-ended'
      : '';
    return `itemx2-encounter-theme-${encounterTheme(monster)} itemx2-threat-${encounterThreatLevel(monster.threat)} ${warning} ${sparring} ${ended}`.trim();
  }

  const codexListFx = (domain, classes) =>
    `<span class="itemx2-codex-fx itemx2-codex-list-fx itemx2-${domain}-list-fx ${classes}" aria-hidden="true"></span>`;

  const codexHeroFx = (domain) =>
    `<span class="itemx2-codex-fx itemx2-codex-hero-fx itemx2-${domain}-hero-fx" aria-hidden="true"><i></i><b></b><em></em></span>`;

  function skillSummaryHtml(skill, rarityMode = 'world') {
    const knownMastery = skill.mastery != null && Number.isFinite(Number(skill.mastery));
    const filled = knownMastery ? Math.max(0, Math.min(5, Math.ceil(Number(skill.mastery) / 20))) : 0;
    const levelLabel = skill.level == null ? 'Lv.미상' : `Lv.${Number(skill.level)}`;
    const masteryLabel = knownMastery ? `숙련 ${Number(skill.mastery)}%` : '숙련 미상';
    return `${codexListFx('skill', skillFxClasses(skill, rarityMode))}<span class="itemx2-codex-glyph">${ITEMXCore.esc(skillEmoji(skill))}</span><span class="itemx2-codex-copy"><strong>${ITEMXCore.esc(skill.name)}</strong><small>${ITEMXCore.esc(skill.rank)} · ${levelLabel} · ${masteryLabel}</small><span class="itemx2-codex-tags"><i>✨ ${ITEMXCore.esc(skill.type)}</i><i>${ITEMXCore.esc(skill.status)}</i>${skill.affinity ? `<i>${ITEMXCore.esc(skill.affinity)}</i>` : ''}</span></span><span class="itemx2-skill-meta"><small>소모</small><b>${ITEMXCore.esc(skill.cost || '없음')}</b><small>재사용</small><b>${ITEMXCore.esc(skill.cooldown || '없음')}</b></span><span class="itemx2-mastery">${Array.from({ length: 5 }, (_, index) => `<i class="${index < filled ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  function skillPageHtml(skill, back, rarityMode = 'world') {
    const knownMastery = skill.mastery != null && Number.isFinite(Number(skill.mastery));
    const mastery = knownMastery ? Math.max(0, Math.min(10, Math.ceil(Number(skill.mastery) / 10))) : 0;
    const levelLabel = skill.level == null ? '미상' : `Lv.${Number(skill.level)}`;
    const masteryLabel = knownMastery ? `${Number(skill.mastery)}%` : '미상';
    const effects = (skill.effects || []).map((one) => `<i>${ITEMXCore.esc(one)}</i>`).join('') || '<i>기록 없음</i>';
    const affinity = skillTheme(skill),
      tier = skillRankTier(skill.rank, rarityMode);
    const fx = ITEMXRenderer.renderSkillFx({ ...skill, affinity }, tier, presentationState.visualEffectsEnabled ? 'full' : 'off');
    const vars = ITEMXRenderer.itemVars({ id: skill.id, name: skill.name, theme: 'arcane', rarity: tier, affinity });
    return `<div class="itemx-codex-page itemx2-codex-page">${back}<section class="itemx-codex-hero itemx-skill-hero craft-arcane ${skillFxClasses(skill, rarityMode)}" style="${vars}">${fx}<span class="itemx-codex-hero-glyph">${ITEMXCore.esc(skillEmoji(skill))}</span><span class="itemx-codex-hero-copy"><small>✨ ARCANE SKILL RECORD</small><strong>${ITEMXCore.esc(skill.name)}</strong><span>${ITEMXCore.esc(skill.rank)} · ${ITEMXCore.esc(skill.school || '미분류')} · ${ITEMXCore.esc(skill.status)}</span></span></section><div class="itemx-codex-stat-grid"><span class="itemx-codex-stat"><small>LEVEL</small><strong>${levelLabel}</strong></span><span class="itemx-codex-stat"><small>TYPE / TARGET</small><strong>${ITEMXCore.esc(skill.type || '미분류')} · ${ITEMXCore.esc(skill.target || '미상')}</strong></span><span class="itemx-codex-stat"><small>COST</small><strong>${ITEMXCore.esc(skill.cost || '없음')}</strong></span><span class="itemx-codex-stat"><small>COOLDOWN</small><strong>${ITEMXCore.esc(skill.cooldown || '없음')}</strong></span></div><section class="itemx-codex-section"><h4>✨ 숙련도 · ${masteryLabel}</h4><span class="itemx-codex-mastery">${Array.from({ length: 10 }, (_, index) => `<i class="${index < mastery ? 'on' : ''}"></i>`).join('')}</span></section>${skill.description ? `<section class="itemx-codex-section"><h4>📜 기술 해설</h4><p>${ITEMXCore.esc(skill.description)}</p></section>` : ''}<section class="itemx-codex-section"><h4>💫 발현 효과</h4><span class="itemx-codex-chip-row">${effects}</span></section><section class="itemx-codex-section"><h4>📈 성장 기록</h4><p>${ITEMXCore.esc(skill.growth || '기록 없음')}</p><small>ID · ${ITEMXCore.esc(skill.id)}</small></section>${detailAnnotations('skill', skill)}</div>`;
  }

  function monsterSummaryHtml(monster, portrait = '') {
    const visual = portrait
      ? `<img src="${ITEMXCore.esc(portrait)}" alt="">`
      : `<span class="itemx2-codex-glyph">${ITEMXCore.esc(encounterEmoji(monster))}</span>`;
    return `${codexListFx('encounter', encounterFxClasses(monster))}${visual}<span class="itemx2-codex-copy"><strong>${ITEMXCore.esc(monster.name)}</strong><small>${ITEMXCore.esc(monster.kind)} · 위협 ${ITEMXCore.esc(monster.threat)} · ${ITEMXCore.esc(monster.status)}</small><span class="itemx2-codex-tags"><i>⚔️ ${ITEMXCore.esc(monster.relation)}</i>${(
      monster.weaknesses || []
    )
      .slice(0, 2)
      .map((one) => `<i>🎯 약점 ${ITEMXCore.esc(one)}</i>`)
      .join('')}</span></span><span class="itemx2-codex-glyph">${monster.active ? '⚔️' : '📖'}</span>`;
  }

  function monsterPageHtml(monster, portrait, back) {
    const visual = portrait
      ? `<img class="itemx-monster-portrait" src="${ITEMXCore.esc(portrait)}" alt="">`
      : `<span class="itemx-codex-hero-glyph">${ITEMXCore.esc(encounterEmoji(monster))}</span>`;
    const chips = (label, values, fallback) =>
      `<section class="itemx-codex-section"><h4>${label}</h4><span class="itemx-codex-chip-row">${(values || []).map((one) => `<i>${ITEMXCore.esc(one)}</i>`).join('') || `<i>${fallback}</i>`}</span></section>`;
    const outcomeLabels = { ended: '교전 종료', escaped: '도주', defeated: '토벌', dead: '사망', unknown: '결말 기록' };
    const outcomeStatus = themeText(monster.outcomeStatus || monster.status);
    const outcome = monster.outcome
      ? `<section class="itemx-codex-section itemx2-encounter-outcome"><span class="itemx2-encounter-outcome-head"><h4>⚔️ 최근 전투 결과</h4><i>${ITEMXCore.esc(outcomeLabels[outcomeStatus] || '결말 기록')}${monster.outcomeEncounter ? ` · ${Number(monster.outcomeEncounter)}번째 조우` : ''}</i></span><p>${ITEMXCore.esc(monster.outcome)}</p></section>`
      : '';
    const lore = monster._lore
      ? '<section class="itemx-codex-section"><small>📚 로어북 공개 정보로 보완된 기록</small></section>'
      : '';
    return `<div class="itemx-codex-page itemx2-codex-page">${back}<section class="itemx-codex-hero itemx-monster-hero ${encounterFxClasses(monster)}">${codexHeroFx('encounter')}<b class="itemx-threat-banner">⚠️ THREAT · ${ITEMXCore.esc(monster.threat || '미상')}</b>${visual}<span class="itemx-codex-hero-copy"><small>⚔️ ENCOUNTER ARCHIVE</small><strong>${ITEMXCore.esc(monster.name)}</strong><span>${ITEMXCore.esc(monster.kind || '미분류')} · ${ITEMXCore.esc(monster.relation)} · ${ITEMXCore.esc(monster.status)}</span></span></section><div class="itemx-codex-stat-grid"><span class="itemx-codex-stat"><small>ENCOUNTERS</small><strong>⚔️ ${Number(monster.encounterCount) || 1}회</strong></span><span class="itemx-codex-stat"><small>COMBAT STATE</small><strong>${monster.active ? '🔥 현재 교전 기록' : '📖 보관 기록'}</strong></span></div>${outcome}${monster.description ? `<section class="itemx-codex-section"><h4>👁️ 관찰 기록</h4><p>${ITEMXCore.esc(monster.description)}</p></section>` : ''}${chips('🏷️ 별칭', monster.aliases, '없음')}${chips('🎯 확인된 약점', monster.weaknesses, '미상')}${chips('🛡️ 확인된 내성', monster.resistances, '미상')}${chips('💥 관측 행동', monster.moves, '미상')}${lore}<section class="itemx-codex-section"><small>ID · ${ITEMXCore.esc(monster.id)}</small></section>${detailAnnotations('monster', monster)}</div>`;
  }

  const unwrapCodexPage = (html) =>
    String(html || '')
      .replace(/^<div class="itemx-codex-page itemx2-codex-page">/, '')
      .replace(/<\/div>$/, '');

  const portraitRevision = (portrait) => {
    const source = String(portrait || '');
    if (!source) return 'none';
    const sample = source.length <= 4096 ? source : `${source.slice(0, 2048)}${source.slice(-2048)}`;
    return `${source.length}:${ITEMXCore.fnv1a(sample)}`;
  };

  function codexDetailCacheKey(domain, entity, portrait = '', rarityMode = 'world') {
    const record = presentationRecord(domain, entity?.id);
    const fingerprint = ITEMXCore.fnv1a(
      JSON.stringify([entity || {}, record.previous, record.review, presentationState.visualEffectsEnabled])
    );
    return domain === 'skill'
      ? `skill:${entity?.id || ''}:${fingerprint}:${rarityMode}`
      : `monster:${entity?.id || ''}:${fingerprint}:${portraitRevision(portrait)}`;
  }

  function rootCodexDetailHtml(domain, entity, portrait = '', rarityMode = 'world') {
    const key = codexDetailCacheKey(domain, entity, portrait, rarityMode);
    if (presentationState.detailHtmlCache.has(key)) return presentationState.detailHtmlCache.get(key);
    const back =
      domain === 'skill'
        ? '<label class="itemx-codex-back" for="itemx2-skill-none">‹ 스킬 목록</label>'
        : '<label class="itemx-codex-back" for="itemx2-monster-none">‹ 조우 목록</label>';
    const html = unwrapCodexPage(
      domain === 'skill' ? skillPageHtml(entity, back, rarityMode) : monsterPageHtml(entity, portrait, back)
    );
    presentationState.detailHtmlCache.set(key, html);
    while (presentationState.detailHtmlCache.size > 60)
      presentationState.detailHtmlCache.delete(presentationState.detailHtmlCache.keys().next().value);
    return html;
  }

  function rootBadgeHtml() {
    const update = hostState.update.available
      ? `<span class="itemx2-update-indicator" x-itemx2-update="${ITEMXCore.esc(hostState.update.latest)}" aria-label="ITEMX CODEX 업데이트 가능">↑</span>`
      : '';
    return `<div class="itemx2-native-badge" x-itemx2-badge="launcher" aria-label="ITEMX CODEX"><img src="${ITEMX_BADGE_ICON}" alt="ITEMX CODEX">${update}</div><div class="itemx2-aux-status ${auxState.auxActive > 0 ? 'itemx2-aux-status-on' : ''}" aria-live="polite"><i></i><span class="itemx2-aux-status-label">${ITEMXCore.esc(auxWorkingLabel())}</span></div><div class="itemx2-feedback" role="status" aria-live="polite"></div>`;
  }

  const updateLabelHtml = () =>
    hostState.update.available
      ? `<span class="itemx2-update-label" x-itemx2-update="${ITEMXCore.esc(hostState.update.latest)}">UPDATE</span>`
      : '';

  function panelMenuHtml(native = true) {
    return `<div class="itemx2-panel-actions"><button class="itemx-ph-btn itemx2-history-open" data-action="history-open" type="button" aria-label="기록 보기" title="기록 보기">기록</button><button class="itemx-ph-btn ${native ? 'itemx2-root-close' : ''}" data-action="close" type="button" aria-label="닫기" title="닫기">✕</button></div>`;
  }

  function historyDomain(tab) {
    return tab === 'skills' ? 'skill' : tab === 'bestiary' ? 'monster' : 'item';
  }

  function selectHistoryRows(loaded) {
    const view = uiState.historyView;
    const rows = ITEMXHistory.entries(loaded, view.domain).filter((row) => row.closed);
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

  async function prepareHistoryPortraits(loaded) {
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

  function historyHtml(loaded) {
    const view = uiState.historyView;
    const { pages, selected } = selectHistoryRows(loaded);
    const prefs = ITEMXHistory.preferences(loaded.chat);
    const filters = [
      ['recent', '최근 기록'],
      ...(view.domain === 'item'
        ? [
            ['consume', '소모'],
            ['loss', '파손·소실']
          ]
        : []),
      ['kept', '보존'],
      ['archived', '보관됨']
    ];
    const buttons = (row, index) =>
      `<div class="itemx2-history-actions"><button class="itemx2-history-keep-${index}" type="button">${row.kept ? '보존 해제' : '보존'}</button>${!row.kept && !row.archived && row.cycle ? `<button class="itemx2-history-archive-${index}" type="button">지금 보관</button>` : ''}</div>`;
    const label = (row) =>
      row.kept
        ? '보존 중 · 자동 정리 제외'
        : row.archived
          ? '보관된 기록 · 보존으로 꺼내기'
          : row.automatic && row.remaining !== null
            ? `소모 완료 · ${row.remaining}회 입력 뒤 자동 보관`
            : row.domain === 'item'
              ? '소실·양도 기록 · 자동 정리 안 함'
              : row.domain === 'skill'
                ? '상실·망각 기록'
                : '종료된 조우';
    const cards = uiState.historyRows
      .map(
        (row, index) =>
          `<section class="itemx2-history-row itemx2-history-row-${index}"><button class="itemx2-history-detail-${index}" type="button"><strong>${row.domain === 'monster' && loaded.historyThumbnails?.[row.entity.id] ? `<img src="${ITEMXCore.esc(loaded.historyThumbnails[row.entity.id])}" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:6px;vertical-align:middle">` : ITEMXCore.esc(row.domain === 'item' ? ITEMXCore.resolveItemEmoji(row.entity) : row.entity.glyph || '📖')} ${ITEMXCore.esc(row.entity.name)}</strong><small>${label(row)}</small></button>${buttons(row, index)}</section>`
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
    return `<header class="itemx2-history-heading"><button class="itemx2-history-back" type="button">‹ ${selected ? '기록 목록' : '현재 목록'}</button><strong>${{ item: '아이템', skill: '스킬', monster: '조우' }[view.domain]} 기록</strong></header><nav class="itemx2-history-filters">${filters.map(([key, label]) => `<button class="itemx2-history-filter-${key} ${view.filter === key ? 'itemx2-history-filter-on' : ''}" type="button">${label}</button>`).join('')}</nav><div class="itemx2-history-policy"><span>소모품 자동 보관</span><button class="itemx2-history-retention" type="button">${prefs.after ? `${prefs.after}회 입력 후` : 'OFF'}</button><small>정상 응답이 완료된 새 입력만 계산합니다. 무기·스킬·조우는 자동 보관하지 않습니다. 원본 사건은 삭제하지 않습니다.</small></div><div class="itemx2-history-list">${selected ? detail : cards || '<p>해당 기록이 없습니다.</p>'}</div>${!selected && pages > 1 ? `<footer class="itemx2-history-actions"><button class="itemx2-history-prev" type="button">‹</button><span>${view.page + 1} / ${pages}</span><button class="itemx2-history-next" type="button">›</button></footer>` : ''}`;
  }

  async function saveHistoryPreference(loaded, update) {
    await (async () => {
      const active = await context();
      if (!active || active.key !== loaded.key) throw new Error('채팅이 변경되었습니다.');
      const latest = await readChat(active.characterIndex, active.chatIndex);
      if (!latest) throw new Error('현재 채팅을 찾을 수 없습니다.');
      if (latest?.isStreaming || latest?.message?.some((message) => message.isStreaming))
        throw new Error('응답이 끝난 뒤 기록 설정을 변경해 주세요.');
      const prefs = ITEMXHistory.preferences(latest);
      update(prefs);
      const next = { ...latest, scriptstate: { ...latest.scriptstate, [ITEMXHistory.KEY]: JSON.stringify(prefs) } };
      await saveChat(active.characterIndex, active.chatIndex, next);
      loaded.chat = next;
      if (pipelineState.cachedLoaded?.key === loaded.key) pipelineState.cachedLoaded.chat = next;
    })();
  }

  async function historyAction(action, loaded, native) {
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
        prefs.after = ITEMXHistory.LIMITS[(ITEMXHistory.LIMITS.indexOf(prefs.after) + 1) % ITEMXHistory.LIMITS.length];
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
    if (native) await drawRootHistory(loaded);
    else await drawIframeHistory(loaded);
  }

  async function drawRootHistory(loaded) {
    await prepareHistoryPortraits(loaded);
    const body = await queryMainClass('itemx2-root-tab-body');
    if (!body) return;
    let pane = await queryMainClass('itemx2-history-pane');
    if (!uiState.historyView.open || uiState.historyView.key !== loaded.key) {
      await pane?.remove();
      await body.removeClass('x-risu-itemx2-history-opened');
      return;
    }
    if (!pane) {
      pane = await hostState.mainDoc.createElement('section');
      await pane.addClass('x-risu-itemx2-history-pane');
      await body.appendChild(pane);
    }
    await pane.setInnerHTML(historyHtml(loaded));
    await body.addClass('x-risu-itemx2-history-opened');
  }

  async function drawIframeHistory(loaded) {
    await prepareHistoryPortraits(loaded);
    const body = document.querySelector('.itemx2-iframe-content');
    if (!body) return;
    let pane = body.querySelector('.itemx2-history-pane');
    if (!uiState.historyView.open || uiState.historyView.key !== loaded.key) {
      pane?.remove();
      body.classList.remove('itemx2-history-opened');
      return;
    }
    if (!pane) {
      pane = document.createElement('section');
      pane.className = 'itemx2-history-pane';
      body.appendChild(pane);
    }
    pane.innerHTML = historyHtml(loaded);
    body.classList.add('itemx2-history-opened');
    pane.onclick = entry(
      'ui-action',
      async (event) => {
        const button = event.target.closest('button');
        const token = button && [...button.classList].find((name) => name.startsWith('itemx2-history-'));
        if (!token) return;

        try {
          await historyAction(token.slice('itemx2-history-'.length), loaded, false);
        } catch (error) {
          await notifyUser(error.message, 'error');
        }
      },
      true
    );
  }

  async function routeHistoryControls(event) {
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
        await historyAction(action, loaded, true);
        return true;
      }
    if (uiState.historyView.selected) {
      for (const action of ['keep-0', 'archive-0'])
        if (await eventHitsMainClass(event, `itemx2-history-${action}`)) {
          await historyAction(action, loaded, true);
          return true;
        }
    } else
      for (let index = 0; index < (uiState.historyRows?.length || 0); index++) {
        if (!(await eventHitsMainClass(event, `itemx2-history-row-${index}`))) continue;
        for (const operation of ['keep', 'archive', 'detail'])
          if (await eventHitsMainClass(event, `itemx2-history-${operation}-${index}`)) {
            await historyAction(`${operation}-${index}`, loaded, true);
            return true;
          }
        break;
      }
    return true;
  }

  function frozenBannerHtml() { return ''; }

  function rootInventoryHtml(loaded, open = true, tab = 'inventory') {
    if (!open)
      return `${rootBadgeHtml()}<div class="itemx2-root-layer"><section class="itemx-panel itemx2-root-panel" aria-label="ITEMX CODEX"><div class="itemx2-tab-loading itemx2-open-loading" role="status" aria-live="polite"><i></i><strong>인벤토리 여는 중</strong><small>저장된 화면을 준비하고 있답니다.</small></div></section></div>`;
    const all = itemsOf(loaded.snapshot)
      .filter((item) => tab === 'settings' || !ITEMXHistory.terminal('item', item))
      .slice(0, 60);
    const pageCount = Math.max(1, Math.ceil(all.length / ITEMX_ROOT_PAGE_SIZE));
    uiState.rootItemPage = Math.max(0, Math.min(pageCount - 1, uiState.rootItemPage));
    const pageStart = uiState.rootItemPage * ITEMX_ROOT_PAGE_SIZE;
    const inventoryPage = tab === 'inventory' ? all.slice(pageStart, pageStart + ITEMX_ROOT_PAGE_SIZE) : [];
    const skills = (loaded.codexSnapshot?.skills?.order || [])
      .map((id) => loaded.codexSnapshot.skills.entries[id])
      .filter(Boolean)
      .filter((entity) => !ITEMXHistory.terminal('skill', entity))
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
      ['all', '전체'],
      ['owned', '보유'],
      ['equipped', '장착'],
      ['observed', '관찰']
    ];
    const controls = filters
      .map(
        ([key]) =>
          `<input class="itemx2-root-control itemx2-root-filter-${key}" id="itemx2-filter-${key}" name="itemx2-filter" type="radio" ${key === 'all' ? 'checked' : ''}>`
      )
      .join('');
    const skillList =
      tab === 'skills'
        ? skills
            .map(
              (skill, index) =>
                `<div class="itemx2-codex-entry"><input class="itemx2-root-control itemx2-codex-entry-choice itemx2-skill-entry-choice" id="itemx2-skill-${index}" name="itemx2-skill-detail" type="radio"><label class="itemx2-codex-card itemx2-codex-summary itemx2-skill-card" for="itemx2-skill-${index}">${skillSummaryHtml(skill, loaded.rarityMode)}</label><div class="itemx-codex-page itemx2-codex-page itemx2-skill-detail itemx2-root-skill-detail-body-${index}"><span class="itemx2-codex-detail-index">${index}</span><span class="itemx2-detail-loading">상세 정보를 불러오는 중…</span></div></div>`
            )
            .join('') || '<div class="itemx2-codex-empty">아직 확정된 스킬이 없답니다.</div>'
        : '';
    const monsterList =
      tab === 'bestiary'
        ? monsters
            .map((monster, index) => {
              const portrait = loaded.portraits?.[monster.id] || '';
              return `<div class="itemx2-codex-entry"><input class="itemx2-root-control itemx2-codex-entry-choice itemx2-monster-entry-choice" id="itemx2-monster-${index}" name="itemx2-monster-detail" type="radio"><label class="itemx2-codex-card itemx2-codex-summary itemx2-bestiary-card ${monster.active ? 'active' : ''}" for="itemx2-monster-${index}">${monsterSummaryHtml(monster, portrait)}</label><div class="itemx-codex-page itemx2-codex-page itemx2-monster-detail itemx2-root-monster-detail-body-${index}"><span class="itemx2-codex-detail-index">${index}</span><span class="itemx2-detail-loading">상세 정보를 불러오는 중…</span></div></div>`;
            })
            .join('') || '<div class="itemx2-codex-empty">실제 전투나 합의된 대련이 발생하면 등록된답니다.</div>'
        : '';
    const list =
      tab === 'inventory'
        ? inventoryPage
            .map((item, index) => {
              const detailId = `itemx2-detail-${index}`;
              const tile = ITEMXRenderer.renderTile(item)
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
              return `<div class="itemx2-root-item ${classes}"><input class="itemx2-root-control itemx2-root-detail-choice" id="${detailId}" name="itemx2-detail" type="radio"><label class="itemx2-root-tile-label itemx2-root-tile-${index}" for="${detailId}">${tile}</label><div class="itemx2-root-detail itemx-body"><label class="itemx-back itemx2-root-back" for="itemx2-detail-none">‹ 목록으로</label><div class="itemx-detail itemx2-root-detail-body-${index}"><span class="itemx2-detail-loading">상세 정보를 불러오는 중…</span></div></div></div>`;
            })
            .join('') || '<div class="itemx2-root-empty">표시할 아이템이 없답니다.</div>'
        : '';
    const enabled = loaded.enabled === true;
    const skin = SETTINGS_SKINS.native;
    const positionChoices = tab === 'settings' ? settingsPositionChoices(skin) : '';
    const fontChoices = tab === 'settings' ? settingsFontChoices(loaded, skin) : '';
    const domainControls = settingsDomainControls(loaded, skin);
    const debugLog = settingsDebugLog();
    const storageParts = settingsStorageParts(loaded);
    // A map of the screen beats six abbreviations: the slot sits where the badge will.
    const managerRows =
      tab === 'settings'
        ? all
            .map(
              (item, index) =>
                `<div class="itemx2-manager-row itemx2-manager-row-${index}"><span class="itemx2-manager-name"><strong>${ITEMXCore.esc(ITEMXCore.resolveItemEmoji(item))} ${ITEMXCore.esc(item.name)}</strong><small>${ITEMXCore.esc(item.displayRarity || item.rarity)} · ${ITEMXCore.esc(item.possession)} / ${ITEMXCore.esc(item.location)}</small></span><span class="itemx2-manager-actions"><button class="itemx2-manager-reroll-${index}" type="button">재감정</button><button class="itemx2-manager-remove itemx2-manager-remove-${index}" type="button" ${item.possession === 'removed' ? 'disabled' : ''}>제거</button></span></div>`
            )
            .join('') || '<div class="itemx2-root-empty">관리할 아이템이 없습니다.</div>'
        : '';
    const manager = `<details class="itemx2-manager-fold"><summary>아이템 관리 <small>현재 화면에서 접기·펼치기</small></summary><div class="itemx2-manager-body"><label class="itemx2-manager-label">수정 지시 · 비워두면 순수 재감정<div class="itemx2-manager-editor itemx2-manager-note" contenteditable="true" role="textbox" aria-label="아이템 수정 지시"></div></label><div class="itemx2-manager-list">${managerRows}</div><div class="itemx2-manager-create"><label class="itemx2-manager-label">신규 아이템 생성 지시<div class="itemx2-manager-editor itemx2-manager-create-note" contenteditable="true" role="textbox" aria-label="신규 아이템 생성 지시"></div></label><button class="itemx2-root-setting-button itemx2-manager-create-button" type="button">＋ 신규 아이템 생성</button></div></div></details>`;
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
    const debugPanel = `<details class="itemx2-manager-fold itemx2-debug-fold"><summary>디버그 진단 <small>${loaded.debugEnabled ? 'ON · 최근 30건' : 'OFF'}</small></summary><div class="itemx2-debug-body"><button class="itemx2-root-setting-button itemx2-setting-debug ${loaded.debugEnabled ? 'itemx2-setting-on' : ''}" type="button">로그 ${loaded.debugEnabled ? 'ON' : 'OFF'}</button><div class="itemx2-debug-grid"><b>문맥</b><span>${ITEMXCore.esc(loaded.key)}</span><b>세대</b><span>${pipelineState.generation}</span><b>스냅숏</b><span>${ITEMXCore.esc(loaded.snapshot.fingerprint || '-')} / ${ITEMXCore.esc(loaded.codexSnapshot.fingerprint || '-')}</span><b>항목</b><span>${counts.all} / ${skills.length} / ${monsters.length}</span><b>마지막 오류</b><span>${ITEMXCore.esc(hostState.lastHookError || hostState.lastDomError || '없음')}</span></div><pre class="itemx2-debug-log">${ITEMXCore.esc(debugLog)}</pre><button class="itemx2-root-setting-button itemx2-setting-debug-clear" type="button">로그 비우기</button></div></details>`;
    const settings = settingsPanelHtml(loaded, skin, {
      connection,
      chips,
      domainControls,
      fontChoices,
      positionChoices,
      manager,
      debugPanel,
      ...storageParts
    });
    const pager =
      pageCount > 1
        ? `<span class="itemx2-root-pager"><button class="itemx2-root-page-prev" type="button" ${uiState.rootItemPage === 0 ? 'disabled' : ''}>‹</button><b>${uiState.rootItemPage + 1} / ${pageCount}</b><button class="itemx2-root-page-next" type="button" ${uiState.rootItemPage >= pageCount - 1 ? 'disabled' : ''}>›</button></span>`
        : '';
    const shownEnd = Math.min(all.length, pageStart + inventoryPage.length);
    const inventoryContent = `<div class="itemx2-root-inventory"><nav class="itemx-seg itemx2-root-filters">${filters.map(([key, label]) => `<label class="itemx-seg-i" for="itemx2-filter-${key}">${label} <span class="itemx-seg-n">${counts[key]}</span></label>`).join('')}</nav><div class="itemx-tools itemx2-root-tools"><span class="itemx-tool">${loaded.effectsEnabled ? '✨ 이펙트 ON' : '◇ 이펙트 OFF'}</span><span class="itemx-search">채팅별 저장소</span></div><div class="itemx-body"><div class="itemx-grid">${list}</div></div><footer class="itemx-pf"><span>${all.length ? `${pageStart + 1}-${shownEnd}` : '0'} / ${all.length}점${itemsOf(loaded.snapshot).length > 60 ? ' · 첫 60점' : ''}</span>${pager}</footer></div>`;
    const skillsContent = `<div class="itemx2-root-skills itemx2-root-tab-active"><input class="itemx2-root-control" id="itemx2-skill-none" name="itemx2-skill-detail" type="radio" checked><div class="itemx2-codex-note">장착·봉인·본문에서 다시 언급된 스킬만 모델 문맥에 제한적으로 전달됩니다.</div>${skillList}</div>`;
    const bestiaryContent = `<div class="itemx2-root-bestiary itemx2-root-tab-active"><input class="itemx2-root-control" id="itemx2-monster-none" name="itemx2-monster-detail" type="radio" checked><div class="itemx2-codex-note">단순 등장인물 목록이 아니라 실제 적대·전투·합의된 대련만 기록합니다.</div>${monsterList}</div>`;
    const activeContent =
      tab === 'skills'
        ? skillsContent
        : tab === 'bestiary'
          ? bestiaryContent
          : tab === 'settings'
            ? settings
            : inventoryContent;
    const tabs = [
      ['inventory', '📦 인벤'],
      ['skills', '✨ 스킬'],
      ['bestiary', '⚔️ 조우'],
      ['settings', '⚙️ 설정']
    ]
      .map(
        ([key, label]) =>
          `<button class="itemx-main-tab itemx2-root-tab-${key} ${tab === key ? 'itemx-main-tab-on' : ''}" type="button">${label}</button>`
      )
      .join('');
    const headerStatus = `${enabled ? `보유 ${counts.owned} · 장착 ${counts.equipped} · 관찰 ${counts.observed}` : '현재 봇 비활성'} · ${ITEMXCore.esc(uiState.status)}`;
    return `${controls}${rootBadgeHtml()}<div class="itemx2-root-layer"><section class="itemx-panel itemx2-root-panel" aria-label="ITEMX CODEX"><input class="itemx2-root-control" id="itemx2-detail-none" name="itemx2-detail" type="radio" checked><header class="itemx-ph"><span class="itemx-ph-text"><span class="itemx-ph-eyebrow">ITEMX CODEX · ${ITEMX_VERSION_LABEL}${updateLabelHtml()}</span><span class="itemx-ph-title">${ITEMXCore.esc(loaded.character.name || '인벤토리')}</span><span class="itemx-ph-sub"><!--ITEMX2-HEADER-START-->${headerStatus}<!--ITEMX2-HEADER-END--></span></span>${panelMenuHtml(true)}</header><nav class="itemx-main-tabs"><!--ITEMX2-NAV-START-->${tabs}<!--ITEMX2-NAV-END--></nav>${frozenBannerHtml(true)}<div class="itemx2-root-tab-body"><!--ITEMX2-BODY-START-->${activeContent}<!--ITEMX2-BODY-END--></div></section></div>`;
  }

  function rootInventoryRegions(html) {
    const source = String(html || '');
    const between = (start, end) => {
      const from = source.indexOf(start),
        to = source.indexOf(end, from + start.length);
      return from >= 0 && to >= 0 ? source.slice(from + start.length, to) : null;
    };
    return {
      header: between('<!--ITEMX2-HEADER-START-->', '<!--ITEMX2-HEADER-END-->'),
      nav: between('<!--ITEMX2-NAV-START-->', '<!--ITEMX2-NAV-END-->'),
      body: between('<!--ITEMX2-BODY-START-->', '<!--ITEMX2-BODY-END-->')
    };
  }

  async function updateRootRegions(html) {
    if (!hostState.mainDoc || !uiState.rootDrawer) return false;
    const regions = rootInventoryRegions(html);
    if (regions.header == null || regions.nav == null || regions.body == null) return false;
    const header = await hostState.mainDoc.querySelector('.x-risu-itemx-ph-sub');
    const nav = await hostState.mainDoc.querySelector('.x-risu-itemx-main-tabs');
    const body = await hostState.mainDoc.querySelector('.x-risu-itemx2-root-tab-body');
    if (!header || !nav || !body) return false;
    try {
      await header.setInnerHTML(regions.header);
      await nav.setInnerHTML(regions.nav);
      await body.setInnerHTML(regions.body);
      workQueue.remember('detail', '');
      return true;
    } catch (error) {
      debugRecord('root region fallback', error?.message || String(error));
      return false;
    }
  }

  const rootStateFingerprint = (loaded) =>
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
      JSON.stringify(ITEMXHistory.preferences(loaded.chat)),
      ITEMXHistory.completedTurns(loaded.chat).total
    ].join(':');

  async function managerRowIndexAtY(count, clientY) {
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

  async function eventHitsMainClass(event, className) {
    const element = await queryMainClass(className);
    if (!element) return false;
    const rect = await element.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  async function installRootClickRouter(owner) {
    if (!owner || (uiState.rootClickBindings[0]?.owner === owner && uiState.rootClickBindings.length)) return;
    await removeRootClickRouter();
    const routeBadge = async (event) => {
      try {
        const badge = hostState.mainDoc && (await hostState.mainDoc.querySelector('.x-risu-itemx2-native-badge'));
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
        const cacheReady = loaded.key === pipelineState.activeContextKey && workQueue.revision('loaded-generation') === pipelineState.generation;
        if (Boolean(workQueue.revision('render')) && cacheReady && workQueue.revision('render') === rootStateFingerprint(loaded))
          return true;
        await openRootInventory({ open: true, loaded, tab: uiState.activeRootTab });
        return true;
      } catch (error) {
        fail('native badge click', error);
        return true;
      }
    };
    const routeControls = async (event) => {
      try {
        if (!uiState.rootOpen) return;
        const close = hostState.mainDoc && (await hostState.mainDoc.querySelector('.x-risu-itemx2-root-close'));
        if (close) {
          const closeRect = await close.getBoundingClientRect();
          if (
            event.clientX >= closeRect.left &&
            event.clientX <= closeRect.right &&
            event.clientY >= closeRect.top &&
            event.clientY <= closeRect.bottom
          ) {
            if (uiState.historyView.open && pipelineState.cachedLoaded) {
              uiState.historyView.open = false;
              await drawRootHistory(pipelineState.cachedLoaded);
            }
            await setRootOpen(false);
            return;
          }
        }
        // Header actions are handled before tab and body controls.
        if (await eventHitsMainClass(event, 'itemx2-history-open')) {
          await routeHistoryControls(event);
          return;
        }
        for (const [tab, label] of [
          ['inventory', '인벤토리'],
          ['skills', '스킬'],
          ['bestiary', '조우 도감'],
          ['settings', '설정']
        ]) {
          const button = hostState.mainDoc && (await hostState.mainDoc.querySelector(`.x-risu-itemx2-root-tab-${tab}`));
          if (!button) continue;
          const rect = await button.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            continue;
          if (uiState.activeRootTab === tab && !uiState.historyView.open) return;
          uiState.historyView.open = false;

          {
            if (tab === 'inventory') uiState.rootItemPage = 0;
            const body = hostState.mainDoc && (await hostState.mainDoc.querySelector('.x-risu-itemx2-root-tab-body'));
            if (body) {
              await body.removeClass('x-risu-itemx2-history-opened');
              await body.setInnerHTML(
                `<div class="itemx2-tab-loading" role="status" aria-live="polite"><i></i><strong>${label} 불러오는 중</strong><small>선택한 탭만 준비하고 있답니다.</small></div>`
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
        for (const [direction, selector] of [
          [-1, '.x-risu-itemx2-root-page-prev'],
          [1, '.x-risu-itemx2-root-page-next']
        ]) {
          const button = hostState.mainDoc && (await hostState.mainDoc.querySelector(selector));
          if (!button) continue;
          const rect = await button.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            continue;

          const loaded = await cachedOrRebuildCurrent();
          if (!loaded) return;
          const pageCount = Math.max(
            1,
            Math.ceil(
              Math.min(60, itemsOf(loaded.snapshot).filter((item) => !ITEMXHistory.terminal('item', item)).length) /
                ITEMX_ROOT_PAGE_SIZE
            )
          );
          const nextPage = Math.max(0, Math.min(pageCount - 1, uiState.rootItemPage + direction));
          if (nextPage === uiState.rootItemPage) return;
          uiState.rootItemPage = nextPage;

          {
            const body = hostState.mainDoc && (await hostState.mainDoc.querySelector('.x-risu-itemx2-root-tab-body'));
            if (body)
              await body.setInnerHTML(
                '<div class="itemx2-tab-loading" role="status" aria-live="polite"><i></i><strong>아이템 불러오는 중</strong><small>16개씩 나누어 준비하고 있답니다.</small></div>'
              );
            await delay(24);
            await openRootInventory({ open: true, tab: 'inventory', loaded });
          }
          return;
        }
        if (uiState.activeRootTab === 'inventory') {
          const cached = pipelineState.cachedLoaded;
          const cacheReady =
            cached && cached.key === pipelineState.activeContextKey && workQueue.revision('loaded-generation') === pipelineState.generation;
          const loaded = cacheReady ? cached : await cachedOrRebuildCurrent();
          if (loaded && (await eventHitsMainClass(event, 'itemx2-repair-one'))) {
            const items = rootPageItems(loaded);
            for (let index = 0; index < items.length; index++) {
              if (!(await hostState.mainDoc.querySelector(`#itemx2-detail-${index}:checked`))) continue;
              try {
                const refreshed = await repairOneItem(loaded, items[index].id);
                const detail = await queryMainClass(`itemx2-root-detail-body-${index}`);
                const item = refreshed?.snapshot?.registry?.items?.[items[index].id];
                if (pipelineState.activeContextKey === loaded.key && detail && item)
                  await detail.setInnerHTML(itemDetailHtml(item));
              } catch (error) {
                await notifyUser(error.message || String(error), 'error');
              }
              return;
            }
          }
          if (loaded && loaded.key === pipelineState.activeContextKey) {
            // SafeElement listeners are document-level. While this async
            // callback awaits, the label's native radio action can already
            // hide the clicked tile, making its rectangle zero-sized. Yield
            // once, then use the settled :checked state as the authoritative
            // target before retaining coordinate hit-testing as a fallback.
            await delay(0);
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
              if (detail) await detail.setInnerHTML(itemDetailHtml(detailItems[index]));
              return;
            }
          }
        }
        if (uiState.activeRootTab === 'skills' || uiState.activeRootTab === 'bestiary') {
          const cached = pipelineState.cachedLoaded;
          const cacheReady =
            cached && cached.key === pipelineState.activeContextKey && workQueue.revision('loaded-generation') === pipelineState.generation;
          const loaded = cacheReady ? cached : await cachedOrRebuildCurrent();
          if (loaded && loaded.key === pipelineState.activeContextKey) {
            await delay(0);
            const domain = uiState.activeRootTab === 'skills' ? 'skill' : 'monster';
            if (await hydrateCheckedCodexDetail(domain, loaded)) return;
          }
          return;
        }
        if (uiState.activeRootTab !== 'settings') return;
        const managerFold = hostState.mainDoc && (await hostState.mainDoc.querySelector('.x-risu-itemx2-manager-fold'));
        if (managerFold) {
          const foldRect = await managerFold.getBoundingClientRect();
          const insideManager =
            event.clientX >= foldRect.left &&
            event.clientX <= foldRect.right &&
            event.clientY >= foldRect.top &&
            event.clientY <= foldRect.bottom;
          if (insideManager) {
            const loaded = await cachedOrRebuildCurrent();
            if (loaded) {
              const managedItems = itemsOf(loaded.snapshot).slice(0, 60);
              const index = await managerRowIndexAtY(managedItems.length, event.clientY);
              if (index >= 0) {
                const target = managedItems[index];
                if (await eventHitsMainClass(event, `itemx2-manager-reroll-${index}`)) {
                  const noteElement = await queryMainClass('itemx2-manager-note');
                  const note = (await noteElement?.textContent())?.trim() || '';
                  uiState.status = note ? '정보 수정 감정 중' : '아이템 재감정 중';
                  try {
                    const itemEvent = await runItemModel('reroll', loaded, target, note);
                    await commitManualEvents(loaded, [itemEvent], note ? '정보 수정' : '재감정');
                  } catch (error) {
                    uiState.status = '재감정 실패';
                    await notifyUser(`ITEMX CODEX: ${error.message || error}`, 'error');
                  }
                  await openRootInventory({ open: true, tab: 'settings' });
                  return;
                }
                if (await eventHitsMainClass(event, `itemx2-manager-remove-${index}`)) {
                  if (target.possession === 'removed') return;
                  if (!(await confirmUser(`${target.name}을(를) 현재 채팅 인벤토리에서 제거할까요?`))) return;
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
                    await commitManualEvents(loaded, [itemEvent], '수동 제거');
                  } catch (error) {
                    uiState.status = '수동 제거 실패';
                    await notifyUser(`ITEMX CODEX: ${error.message || error}`, 'error');
                  }
                  await openRootInventory({ open: true, tab: 'settings' });
                  return;
                }
              }
              if (await eventHitsMainClass(event, 'itemx2-manager-create-button')) {
                const createNoteElement = await queryMainClass('itemx2-manager-create-note');
                const createNote = (await createNoteElement?.textContent())?.trim() || '';
                if (!createNote) {
                  await notifyUser('ITEMX CODEX: 생성할 아이템 설명을 입력하세요.', 'error');
                  return;
                }
                uiState.status = '신규 아이템 생성 중';
                try {
                  const itemEvent = await runItemModel('create', loaded, null, createNote);
                  await commitManualEvents(loaded, [itemEvent], '신규 생성');
                } catch (error) {
                  uiState.status = '아이템 생성 실패';
                  await notifyUser(`ITEMX CODEX: ${error.message || error}`, 'error');
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
    const id = await owner.addEventListener(
      'click',
      entry(
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
      ),
      true
    );
    uiState.rootClickBindings = [{ owner, type: 'click', id, capture: true }];
  }

  async function openRootInventory(options = {}) {
    return openRootInventoryNow(options);
  }

  async function openRootInventoryNow({ open = true, tab = 'inventory', loaded: suppliedLoaded = null } = {}) {
    if (uiState.backupOpen) return;
    try {
      if (uiState.activeRootTab !== tab) uiState.historyView.open = false;
      uiState.panelOpen = false;
      try {
        await Risuai.hideContainer();
      } catch {}
      const loaded = suppliedLoaded || (await cachedOrRebuildCurrent());
      if (!loaded) throw new Error('No active chat context');
      if (pipelineState.activeContextKey && pipelineState.activeContextKey !== loaded.key) return;
      loaded.enabled = await isEnabled(loaded.character);
      Object.assign(loaded, await outputSettings(loaded.character));
      settingsState.debugEnabled = loaded.debugEnabled;
      loaded.portraits =
        tab === 'bestiary' && loaded.encountersEnabled
          ? await loadCodexPortraits(loaded.character, loaded.chat, loaded.codexSnapshot, loaded)
          : {};
      const styled = await installMainStyle({ prompt: true });
      if (!styled || !hostState.mainDoc) {
        uiState.status = '메인 화면 권한 필요';
        await notifyUser('ITEMX CODEX를 열려면 메인 화면 권한이 필요합니다.', 'error');
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
        root = await hostState.mainDoc.createElement('div');
      }
      await root.setAttribute('x-itemx2-drawer', 'owner');
      await root.setClassName(
        `x-risu-itemx2-root-drawer x-risu-itemx2-pos-${uiState.badgePosition} x-risu-itemx2-font-${loaded.fontScale || 'small'}${open ? ' x-risu-itemx2-is-open' : ''}${loaded.effectsEnabled ? '' : ' x-risu-itemx2-effects-off'}${SKIN_NAMES.includes(loaded.skin) ? ` x-risu-itemx2-skin-${loaded.skin}` : ''}`
      );
      const html = rootInventoryHtml(loaded, open, tab);
      const regionUpdated = attached && open && Boolean(workQueue.revision('render')) && (await updateRootRegions(html));
      if (!regionUpdated) {
        await root.setInnerHTML(html);
        workQueue.remember('detail', '');
      }
      if (!attached) {
        const body = await hostState.mainDoc.querySelector('body');
        if (!body) throw new Error('Main document body unavailable');
        if (pipelineState.activeContextKey !== loaded.key) return;
        await body.appendChild(root);
        if (pipelineState.activeContextKey !== loaded.key) {
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
      uiState.status = '인벤토리 열기 오류';
      await removeRootDrawer();
      fail('openRootInventory', error);
    }
  }

  function matches(item) {
    if (ui.filter === 'owned' && item.possession !== 'owned') return false;
    if (ui.filter === 'equipped' && item.location !== 'equipped') return false;
    if (ui.filter === 'observed' && item.possession !== 'observed') return false;
    if (ui.filter === 'removed' && item.possession !== 'removed') return false;
    const q = ui.query.trim().toLowerCase();
    return (
      !q ||
      [item.name, item.id, item.itemType, item.displayRarity, item.affinity, item.affinity2].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(q)
      )
    );
  }

  function drawInventory(loaded) {
    const root = document.querySelector('#itemx2-root');
    if (!root) return;
    const all = itemsOf(loaded.snapshot),
      selected = ui.selected && all.find((item) => item.id === ui.selected && !ITEMXHistory.terminal('item', item));
    const counts = {
      all: all.filter((item) => !ITEMXHistory.terminal('item', item)).length,
      owned: all.filter((item) => item.possession === 'owned').length,
      equipped: all.filter((item) => item.location === 'equipped').length,
      observed: all.filter((item) => item.possession === 'observed').length,
      removed: all.filter((item) => item.possession === 'removed').length
    };
    const visible =
      ui.tab === 'inventory'
        ? all
            .filter((item) => !ITEMXHistory.terminal('item', item))
            .filter(matches)
            .slice(0, 60)
        : [];
    if (ui.tab === 'settings' && (!ui.manageId || !all.some((item) => item.id === ui.manageId)))
      ui.manageId = all.find((item) => item.possession !== 'removed')?.id || all[0]?.id || null;
    const managed = ui.tab === 'settings' && ui.manageId ? all.find((item) => item.id === ui.manageId) : null;
    const manageOptions =
      ui.tab === 'settings'
        ? all
            .map(
              (item) =>
                `<option value="${ITEMXCore.esc(item.id)}" ${item.id === ui.manageId ? 'selected' : ''}>${ITEMXCore.esc(ITEMXCore.resolveItemEmoji(item))} ${ITEMXCore.esc(item.name)} · ${ITEMXCore.esc(item.id)}</option>`
            )
            .join('')
        : '';
    const enabled = loaded.enabled === true;
    const inventoryContent = !enabled
      ? `<div class="itemx-disabled"><strong>현재 봇에서 ITEMX CODEX가 꺼져 있답니다.</strong><span>설정 탭에서 다시 활성화할 수 있습니다.</span><button class="itemx-tool" data-tab="settings">설정 열기</button></div>`
      : selected
        ? `<div class="itemx-body"><button class="itemx-back" data-action="back">‹ 목록으로</button><div class="itemx-detail">${ITEMXRenderer.renderCard(selected, { motion: ui.motion && presentationState.visualEffectsEnabled ? 'full' : 'off' })}${detailAnnotations('item', selected)}</div></div>`
        : `<nav class="itemx-seg">${[
            ['all', '전체'],
            ['owned', '보유'],
            ['equipped', '장착'],
            ['observed', '관찰']
          ]
            .map(
              ([key, label]) =>
                `<button class="itemx-seg-i ${ui.filter === key ? 'itemx-seg-on' : ''}" data-filter="${key}">${label} <span class="itemx-seg-n">${counts[key]}</span></button>`
            )
            .join(
              ''
            )}</nav><div class="itemx-tools"><button class="itemx-tool" data-action="motion">${ui.motion ? '✦ 모션' : '◇ 정지'}</button><input class="itemx-search itemx-search-input" value="${ITEMXCore.esc(ui.query)}" placeholder="검색" aria-label="검색"><button class="itemx-tool" data-action="rebuild">↻</button></div><div class="itemx-body"><div class="itemx-grid">${visible.map(ITEMXRenderer.renderTile).join('') || '<div class="itemx-empty">표시할 아이템이 없답니다.</div>'}</div></div><footer class="itemx-pf">${visible.length}점 표시${all.filter(matches).length > 60 ? ' · 첫 60점' : ''}</footer>`;
    const permissionLabel =
      hostState.permissions.replacer === true
        ? '연결됨'
        : hostState.permissions.replacer === false
          ? '권한 필요'
          : '확인 중';
    const styleLabel =
      hostState.permissions.mainDom === true
        ? '고정 스타일'
        : hostState.permissions.mainDom === false
          ? '본문 폴백'
          : '확인 중';
    // Same controls as the drawer: a map of the screen and real size previews.
    const skin = SETTINGS_SKINS.frame;
    const positionChoices = settingsPositionChoices(skin);
    const fontChoices = settingsFontChoices(loaded, skin);
    const domainControls = settingsDomainControls(loaded, skin);
    const debugLog = settingsDebugLog();
    const storageParts = settingsStorageParts(loaded);
    const managerContent = `<section class="itemx-manager"><div class="itemx-manager-title">아이템 운영 도구</div><label class="itemx-manager-field"><span>대상 아이템</span><select data-action="manage-select" ${all.length ? '' : 'disabled'}>${manageOptions || '<option>아이템 없음</option>'}</select></label><label class="itemx-manager-field"><span>수정 지시 · 비워두면 순수 재감정</span><textarea data-action="manage-note" placeholder="예: 이름은 그대로 두고 내구도를 31/100으로, 화염 속성은 제거"></textarea></label><div class="itemx-manager-actions"><button class="itemx-tool" data-action="manage-reroll" ${managed ? '' : 'disabled'}>🔄 정보 수정·재감정</button><button class="itemx-tool itemx-manager-danger" data-action="manage-remove" ${managed && managed.possession !== 'removed' ? '' : 'disabled'}>🗑 수동 제거</button></div><div class="itemx-manager-current">${managed ? `${ITEMXCore.esc(managed.name)} · ${ITEMXCore.esc(managed.displayRarity || managed.rarity)} · ${ITEMXCore.esc(managed.possession)} / ${ITEMXCore.esc(managed.location)}` : '선택 가능한 아이템이 없습니다.'}</div><label class="itemx-manager-field"><span>신규 아이템 생성 지시</span><textarea data-action="create-note" placeholder="예: 주인공이 획득한 번개 속성의 희귀 장검"></textarea></label><button class="itemx-tool" data-action="manage-create">＋ 신규 아이템 생성 시도</button><small class="itemx-manager-help">보조 모델 결과는 ITEMX 엄격 파서와 id 검증을 통과한 경우에만 채팅별 사건 원장에 반영됩니다.</small></section>`;
    const debugContent = `<details class="itemx-codex-fold"><summary><strong>디버그 진단 · ${loaded.debugEnabled ? 'ON' : 'OFF'}</strong><small>훅·스냅숏·최근 로그</small></summary><div class="itemx-codex-detail"><span>문맥 ${ITEMXCore.esc(loaded.key)}</span><span>스냅숏 ${ITEMXCore.esc(loaded.snapshot.fingerprint || '-')} / ${ITEMXCore.esc(loaded.codexSnapshot.fingerprint || '-')}</span><span>오류 ${ITEMXCore.esc(hostState.lastHookError || hostState.lastDomError || '없음')}</span><div class="itemx-manager-actions"><button class="itemx-tool ${loaded.debugEnabled ? 'itemx-setting-on' : ''}" data-action="debug-toggle">로그 ${loaded.debugEnabled ? 'ON' : 'OFF'}</button><button class="itemx-tool" data-action="debug-clear">비우기</button></div><pre class="itemx-debug-log">${ITEMXCore.esc(debugLog)}</pre></div></details>`;
    const settingsContent = settingsPanelHtml(loaded, skin, {
      permissionLabel,
      styleLabel,
      domainControls,
      fontChoices,
      positionChoices,
      manager: managerContent,
      debugPanel: debugContent,
      ...storageParts
    });
    const iframeSkills =
      ui.tab === 'skills'
        ? (loaded.codexSnapshot?.skills?.order || [])
            .map((id) => loaded.codexSnapshot.skills.entries[id])
            .filter(Boolean)
            .filter((entity) => !ITEMXHistory.terminal('skill', entity))
        : [];
    const iframeMonsters = ui.tab === 'bestiary' ? ITEMXHistory.currentEntities(loaded, 'monster') : [];
    const selectedSkill = ui.selectedSkill && iframeSkills.find((one) => one.id === ui.selectedSkill);
    const selectedMonster = ui.selectedMonster && iframeMonsters.find((one) => one.id === ui.selectedMonster);
    const skillRows = iframeSkills
      .map(
        (one) =>
          `<button class="itemx-codex-list-button itemx2-codex-card itemx2-codex-summary" data-skill-id="${ITEMXCore.esc(one.id)}">${skillSummaryHtml(one, loaded.rarityMode)}</button>`
      )
      .join('');
    const monsterRows = iframeMonsters
      .map(
        (one) =>
          `<button class="itemx-codex-list-button itemx2-codex-card itemx2-codex-summary itemx2-bestiary-card ${one.active ? 'active' : ''}" data-monster-id="${ITEMXCore.esc(one.id)}">${monsterSummaryHtml(one, loaded.portraits?.[one.id] || '')}</button>`
      )
      .join('');
    const skillsContent = `<div class="itemx-settings">${selectedSkill ? skillPageHtml(selectedSkill, '<button class="itemx-codex-back" data-action="back-skill">‹ 스킬 목록</button>', loaded.rarityMode).replace('itemx2-codex-page', 'itemx-codex-page-active') : `<div class="itemx-codex-list">${skillRows || '<div class="itemx-empty">아직 확정된 스킬이 없답니다.</div>'}</div>`}</div>`;
    const bestiaryContent = `<div class="itemx-settings">${selectedMonster ? monsterPageHtml(selectedMonster, loaded.portraits?.[selectedMonster.id] || '', '<button class="itemx-codex-back" data-action="back-monster">‹ 조우 목록</button>').replace('itemx2-codex-page', 'itemx-codex-page-active') : `<div class="itemx-codex-list">${monsterRows || '<div class="itemx-empty">실제 전투나 합의된 대련이 발생하면 등록된답니다.</div>'}</div>`}</div>`;
    const content =
      ui.tab === 'settings'
        ? settingsContent
        : ui.tab === 'skills'
          ? skillsContent
          : ui.tab === 'bestiary'
            ? bestiaryContent
            : inventoryContent;
    root.innerHTML = `<div class="risu-shell"><main class="stage itemx-plugin-stage ${uiState.compactContainer ? '' : 'itemx-plugin-stage-fallback'}"><section class="itemx-panel itemx2-font-${loaded.fontScale || 'small'} ${loaded.effectsEnabled ? '' : 'itemx2-effects-off'} ${SKIN_NAMES.includes(loaded.skin) ? `itemx2-skin-${loaded.skin}` : ''}" aria-label="ITEMX CODEX"><header class="itemx-ph"><span class="itemx-ph-text"><span class="itemx-ph-eyebrow">ITEMX CODEX · ${ITEMX_VERSION_LABEL}${updateLabelHtml()}</span><span class="itemx-ph-title">${ITEMXCore.esc(loaded.character.name || '인벤토리')}</span><span class="itemx-ph-sub">${enabled ? `보유 ${counts.owned} · 장착 ${counts.equipped} · 관찰 ${counts.observed}` : '현재 봇 비활성'} · ${ITEMXCore.esc(uiState.status)}</span></span>${panelMenuHtml(false)}</header><nav class="itemx-main-tabs"><button class="itemx-main-tab ${ui.tab === 'inventory' ? 'itemx-main-tab-on' : ''}" data-tab="inventory">📦 인벤</button><button class="itemx-main-tab ${ui.tab === 'skills' ? 'itemx-main-tab-on' : ''}" data-tab="skills">✨ 스킬</button><button class="itemx-main-tab ${ui.tab === 'bestiary' ? 'itemx-main-tab-on' : ''}" data-tab="bestiary">⚔️ 조우</button><button class="itemx-main-tab ${ui.tab === 'settings' ? 'itemx-main-tab-on' : ''}" data-tab="settings">⚙️ 설정</button></nav>${frozenBannerHtml(false)}<div class="itemx2-iframe-content">${content}</div></section></main></div>`;
    root.querySelector('[data-action="close"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        () => {
          uiState.historyView.open = false;
          void closeInventory();
        },
        true
      )
    );
    root.querySelector('[data-action="history-open"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        () => {
          uiState.historyView = {
            open: true,
            key: loaded.key,
            domain: historyDomain(ui.tab),
            filter: 'recent',
            selected: null,
            page: 0
          };
          drawIframeHistory(loaded);
        },
        true
      )
    );
    if (uiState.historyView.open) drawIframeHistory(loaded);
    root.querySelector('[data-action="back"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        () => {
          ui.selected = null;
          drawInventory(loaded);
        },
        true
      )
    );
    root.querySelector('[data-action="back-skill"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        () => {
          ui.selectedSkill = null;
          drawInventory(loaded);
        },
        true
      )
    );
    root.querySelector('[data-action="back-monster"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        () => {
          ui.selectedMonster = null;
          drawInventory(loaded);
        },
        true
      )
    );
    root.querySelector('[data-action="motion"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        () => {
          ui.motion = !ui.motion;
          drawInventory(loaded);
        },
        true
      )
    );
    root.querySelector('[data-action="repair-one"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          if (!selected) return;
          try {
            drawInventory(await repairOneItem(loaded, selected.id));
          } catch (error) {
            await notifyUser(error.message || String(error), 'error');
          }
        },
        true
      )
    );
    root.querySelector('[data-action="toggle"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          loaded.enabled = !enabled;
          await setEnabled(loaded.character, loaded.enabled);
          uiState.status = loaded.enabled ? '현재 봇 활성화' : '현재 봇 비활성화';
          drawInventory(loaded);
        },
        true
      )
    );
    for (const [domain, key, label] of [
      ['items', 'itemsEnabled', '무기·아이템'],
      ['skills', 'skillsEnabled', '스킬'],
      ['encounters', 'encountersEnabled', '전투 도감']
    ])
      root.querySelector(`[data-action="domain-${domain}"]`)?.addEventListener(
        'click',
        entry(
          'ui-action',
          async () => {
            loaded[key] = !loaded[key];
            await setDomainEnabled(loaded.character, domain, loaded[key]);
            uiState.status = `${label} · ${loaded[key] ? 'ON' : 'OFF'}`;
            drawInventory(loaded);
          },
          true
        )
      );
    root.querySelector('[data-action="debug-toggle"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          loaded.debugEnabled = !loaded.debugEnabled;
          await setDebugEnabled(loaded.character, loaded.debugEnabled);
          uiState.status = `디버그 로그 · ${loaded.debugEnabled ? 'ON' : 'OFF'}`;
          drawInventory(loaded);
        },
        true
      )
    );
    root.querySelector('[data-action="debug-clear"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        () => {
          settingsState.debugEntries = [];
          uiState.status = '디버그 로그 비움';
          drawInventory(loaded);
        },
        true
      )
    );
    root.querySelector('[data-action="aux-run"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          if (auxState.auxActive > 0) return;
          uiState.status = '보조 모델 수동 검사 중';
          drawInventory(loaded);
          try {
            await recoverAuxiliaryOutput({ force: true });
          } catch (error) {
            uiState.status = '보조 모델 검사 실패';
            await notifyUser(`ITEMX CODEX: ${error.message || error}`, 'error');
          }
          const next = await rebuildCurrent();
          drawInventory(next || loaded);
        },
        true
      )
    );
    root.querySelector('[data-action="main-output"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          loaded.mainOutput = !loaded.mainOutput;
          await setMainOutput(loaded.character, loaded.mainOutput);
          uiState.status = `메인 출력 · ${loaded.mainOutput ? 'ON' : 'OFF'}`;
          drawInventory(loaded);
        },
        true
      )
    );
    root.querySelector('[data-action="effects"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          loaded.effectsEnabled = !loaded.effectsEnabled;
          await setEffectsEnabled(loaded.character, loaded.effectsEnabled);
          uiState.status = `시각 이펙트 · ${loaded.effectsEnabled ? 'ON' : 'OFF'}`;
          drawInventory(loaded);
        },
        true
      )
    );
    root.querySelector('[data-action="module-assets"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          if (loaded.moduleAssetsEnabled) {
            loaded.moduleAssetsEnabled = false;
            await setModuleAssetsEnabled(loaded.character, false);
            uiState.status = '모듈 에셋 초상화 · OFF';
            drawInventory(loaded);
            return;
          }
          const enabled = await enableModuleAssets(loaded.character, loaded.chat);
          loaded.moduleAssetsEnabled = enabled;
          uiState.status = enabled ? '모듈 에셋 초상화 · ON' : '모듈 에셋 권한 없음 · 이모지 폴백';
          if (!enabled)
            await notifyUser('모듈 에셋 권한이 허용되지 않았습니다. 조우 초상화는 이모지로 표시됩니다.', 'error');
          drawInventory(loaded);
        },
        true
      )
    );
    root.querySelector('[data-action="lorebook-toggle"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          loaded.lorebookEncounterEnabled = !loaded.lorebookEncounterEnabled;
          await setLorebookEncounterEnabled(loaded.character, loaded.lorebookEncounterEnabled);
          uiState.status = `조우 로어북 자동 보완 · ${loaded.lorebookEncounterEnabled ? 'ON' : 'OFF'}`;
          if (loaded.lorebookEncounterEnabled) await scanLorebookEncounters({ refresh: true, silent: true });
          const next = await rebuildCurrent();
          if (next) {
            next.enabled = await isEnabled(next.character);
            drawInventory(next);
          } else drawInventory(loaded);
        },
        true
      )
    );
    root.querySelector('[data-action="lorebook-scan"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          uiState.status = '조우 로어북 스캔 중';
          drawInventory(loaded);
          await scanLorebookEncounters({ refresh: true });
          const next = await rebuildCurrent();
          if (next) {
            next.enabled = await isEnabled(next.character);
            drawInventory(next);
          } else drawInventory(loaded);
        },
        true
      )
    );
    root.querySelectorAll('[data-seg]').forEach((button) =>
      button.addEventListener(
        'click',
        entry(
          'ui-action',
          async () => {
            const { seg, value } = button.dataset;
            if (seg === 'aux') {
              await setAuxOutput(loaded.character, value);
              loaded.auxOutput = value;
              uiState.status = `보조 모델로 보완 · ${AUX_LABELS[value]}`;
            } else if (seg === 'rarity') {
              await setRarityMode(loaded.character, value);
              loaded.rarityMode = value;
              uiState.status = `등급 판정 기준 · ${RARITY_MODE_LABELS[value]}`;
            } else if (seg === 'skin') {
              await setSkin(loaded.character, value);
              loaded.skin = value;
              uiState.status = `화면 스킨 · ${SKIN_LABELS[value]}`;
            } else return;
            drawInventory(loaded);
          },
          true
        )
      )
    );
    root.querySelectorAll('[data-font]').forEach((button) =>
      button.addEventListener(
        'click',
        entry(
          'ui-action',
          async () => {
            const value = button.dataset.font;
            await setFontScale(loaded.character, value);
            loaded.fontScale = value;
            uiState.status = `글자 크기 · ${{ small: '작게', medium: '보통', large: '크게' }[value]}`;
            drawInventory(loaded);
          },
          true
        )
      )
    );
    root.querySelector('[data-action="rebuild"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          const next = await rebuildCurrent();
          if (next) {
            next.enabled = await isEnabled(next.character);
            drawInventory(next);
          }
        },
        true
      )
    );
    root.querySelector('[data-action="storage-cleanup"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          if (uiState.storageCleanupArmedUntil <= Date.now()) {
            uiState.storageCleanupArmedUntil = Date.now() + 7000;
            uiState.status = '최적화 확인 대기 · 7초 안에 다시 누르세요';
            drawInventory(loaded);
            return;
          }
          uiState.status = '현재 채팅 저장소 최적화 중';
          drawInventory(loaded);
          try {
            const result = await compactCurrentChatStorage();
            if (result.loaded) drawInventory(result.loaded);
          } catch (error) {
            uiState.storageCleanupArmedUntil = 0;
            uiState.status = '저장소 최적화 실패';
            await notifyUser(`ITEMX CODEX 저장소 최적화 실패: ${error.message || error}`, 'error');
            drawInventory(loaded);
          }
        },
        true
      )
    );
    root.querySelector('[data-action="backup"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          try {
            await openBackupPanel();
          } catch (error) {
            await notifyUser(error.message, 'error');
          }
        },
        true
      )
    );
    root.querySelector('[data-action="cleanup-chat"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          if (uiState.cleanupArmedUntil <= Date.now()) {
            uiState.cleanupArmedUntil = Date.now() + 7000;
            uiState.status = '정리 확인 대기 · 7초 안에 다시 누르세요';
            drawInventory(loaded);
            return;
          }
          uiState.status = '현재 채팅 ITEMX 기록 정리 중';
          drawInventory(loaded);
          try {
            const result = await cleanCurrentChatItemx();
            if (result.loaded) drawInventory(result.loaded);
          } catch (error) {
            uiState.cleanupArmedUntil = 0;
            uiState.status = '현재 채팅 정리 실패';
            await notifyUser(`ITEMX CODEX 정리 실패: ${error.message || error}`, 'error');
            drawInventory(loaded);
          }
        },
        true
      )
    );
    root.querySelector('[data-action="permissions"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          uiState.status = '모델 처리 권한 확인 중';
          drawInventory(loaded);
          const connected = await installPipelineHooks({ prompt: true });
          if (connected) await notifyUser('ITEMX CODEX 모델 처리 권한이 연결되었습니다.', 'success');
          else await notifyUser(`ITEMX CODEX 권한 연결 실패: ${hostState.lastHookError || uiState.status}`, 'error');
          const next = await rebuildCurrent();
          if (next) {
            next.enabled = await isEnabled(next.character);
            drawInventory(next);
          }
        },
        true
      )
    );
    root.querySelector('[data-action="style"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          uiState.status = '본문 화면 연결 중';
          drawInventory(loaded);
          const styled = await installMainStyle({ prompt: true });
          if (styled) await notifyUser('ITEMX CODEX 본문 화면 연결이 완료되었습니다.', 'success');
          else await notifyUser(`ITEMX CODEX 화면 연결 실패: ${hostState.lastDomError || uiState.status}`, 'error');
          drawInventory(loaded);
        },
        true
      )
    );
    root.querySelectorAll('[data-position]').forEach((button) =>
      button.addEventListener(
        'click',
        entry(
          'ui-action',
          async () => {
            const value = button.dataset.position;
            if (!BADGE_POSITIONS.some(([key]) => key === value)) return;
            uiState.badgePosition = value;
            await ITEMXSettings.update(Risuai.pluginStorage, null, { badgePosition: value });
            if (uiState.rootDrawer) {
              for (const [other] of BADGE_POSITIONS) await uiState.rootDrawer.removeClass(`x-risu-itemx2-pos-${other}`);
              await uiState.rootDrawer.addClass(`x-risu-itemx2-pos-${value}`);
            }
            await installMainStyle();
            uiState.status = `배지 위치 · ${BADGE_POSITIONS.find(([key]) => key === value)?.[1] || value}`;
            drawInventory(loaded);
          },
          true
        )
      )
    );
    root.querySelector('[data-action="manage-select"]')?.addEventListener(
      'change',
      entry(
        'ui-action',
        (event) => {
          ui.manageId = event.target.value;
          drawInventory(loaded);
        },
        true
      )
    );
    root.querySelector('[data-action="manage-remove"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          try {
            const target = itemsOf(loaded.snapshot).find((item) => item.id === ui.manageId);
            if (!target) throw new Error('대상 아이템이 없습니다.');
            if (!(await confirmUser(`${target.name}을(를) 현재 채팅 인벤토리에서 제거할까요?`))) return;
            uiState.status = '수동 제거 처리 중';
            drawInventory(loaded);
            const event = {
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
            const next = await commitManualEvents(loaded, [event], '수동 제거');
            if (next) {
              next.enabled = await isEnabled(next.character);
              drawInventory(next);
            }
          } catch (error) {
            uiState.status = '수동 제거 실패';
            await notifyUser(`ITEMX CODEX: ${error.message || error}`, 'error');
            drawInventory(loaded);
          }
        },
        true
      )
    );
    root.querySelector('[data-action="manage-reroll"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          try {
            const target = itemsOf(loaded.snapshot).find((item) => item.id === ui.manageId);
            if (!target) throw new Error('대상 아이템이 없습니다.');
            const note = root.querySelector('[data-action="manage-note"]')?.value?.trim() || '';
            uiState.status = note ? '정보 수정 감정 중' : '아이템 재감정 중';
            drawInventory(loaded);
            const event = await runItemModel('reroll', loaded, target, note);
            const next = await commitManualEvents(loaded, [event], note ? '정보 수정' : '재감정');
            if (next) {
              next.enabled = await isEnabled(next.character);
              drawInventory(next);
            }
          } catch (error) {
            uiState.status = '재감정 실패';
            await notifyUser(`ITEMX CODEX: ${error.message || error}`, 'error');
            drawInventory(loaded);
          }
        },
        true
      )
    );
    root.querySelector('[data-action="manage-create"]')?.addEventListener(
      'click',
      entry(
        'ui-action',
        async () => {
          try {
            const note = root.querySelector('[data-action="create-note"]')?.value?.trim() || '';
            if (!note) throw new Error('생성할 아이템 설명을 입력하세요.');
            uiState.status = '신규 아이템 생성 중';
            drawInventory(loaded);
            const event = await runItemModel('create', loaded, null, note);
            const next = await commitManualEvents(loaded, [event], '신규 생성');
            ui.manageId = event.item.id;
            if (next) {
              next.enabled = await isEnabled(next.character);
              drawInventory(next);
            }
          } catch (error) {
            uiState.status = '아이템 생성 실패';
            await notifyUser(`ITEMX CODEX: ${error.message || error}`, 'error');
            drawInventory(loaded);
          }
        },
        true
      )
    );
    root.querySelectorAll('[data-tab]').forEach((el) =>
      el.addEventListener(
        'click',
        entry(
          'ui-action',
          () => {
            if (ui.tab === el.dataset.tab && !uiState.historyView.open) return;
            ui.tab = el.dataset.tab;
            uiState.historyView.open = false;
            drawIframeHistory(loaded);
            ui.selected = null;
            ui.selectedSkill = null;
            ui.selectedMonster = null;
            const current = root.querySelector('.itemx-main-tabs')?.nextElementSibling;
            if (current)
              current.innerHTML =
                '<div class="itemx2-tab-loading" role="status" aria-live="polite"><i></i><strong>탭 불러오는 중</strong><small>선택한 화면만 준비하고 있답니다.</small></div>';
            setTimeout(
              entry('timer:404371', () => drawInventory(loaded)),
              24
            );
          },
          true
        )
      )
    );
    root.querySelectorAll('[data-filter]').forEach((el) =>
      el.addEventListener(
        'click',
        entry(
          'ui-action',
          () => {
            ui.filter = el.dataset.filter;
            drawInventory(loaded);
          },
          true
        )
      )
    );
    root.querySelectorAll('[data-item-id]').forEach((el) =>
      el.addEventListener(
        'click',
        entry(
          'ui-action',
          () => {
            ui.selected = el.dataset.itemId;
            drawInventory(loaded);
          },
          true
        )
      )
    );
    root.querySelectorAll('[data-skill-id]').forEach((el) =>
      el.addEventListener(
        'click',
        entry(
          'ui-action',
          () => {
            ui.selectedSkill = el.dataset.skillId;
            drawInventory(loaded);
          },
          true
        )
      )
    );
    root.querySelectorAll('[data-monster-id]').forEach((el) =>
      el.addEventListener(
        'click',
        entry(
          'ui-action',
          () => {
            ui.selectedMonster = el.dataset.monsterId;
            drawInventory(loaded);
          },
          true
        )
      )
    );
    root.querySelector('.itemx-search-input')?.addEventListener(
      'input',
      entry(
        'ui-action',
        (event) => {
          ui.query = event.target.value;
          drawInventory(loaded);
          const input = root.querySelector('.itemx-search-input');
          input?.focus();
          input?.setSelectionRange(ui.query.length, ui.query.length);
        },
        true
      )
    );
  }

  function reducedMotion() {
    return (
      typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  async function closeInventory({ immediate = false } = {}) {
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
    await Risuai.hideContainer();
    uiState.allowDrawerOverSettings = false;
    invalidateHostSettingsVisibility();
    await syncHostSettingsVisibility();
  }

  async function openInventory(tab = 'inventory') {
    if (tab === 'inventory') return openRootInventory();
    uiState.panelOpen = true;
    ui.tab = tab;
    try {
      const compact = window.innerWidth <= 520;
      const panelWidth = compact ? Math.max(320, window.innerWidth - 32) : 420;
      const panelHeight = Math.max(420, Math.min(700, Math.round(window.innerHeight * (compact ? 0.72 : 0.78))));
      uiState.compactContainer = true;
      try {
        await Risuai.resizeContainer(panelHeight, panelWidth);
      } catch (error) {
        uiState.compactContainer = false;
        uiState.status = 'PocketRisu 호환 모드';
        log('resizeContainer unavailable; using bounded fullscreen fallback');
      }
      document.head.innerHTML = fallbackDocumentHead();
      document.body.innerHTML = '<div id="itemx2-root"></div>';
      const loaded = await rebuildCurrent();
      if (!loaded) throw new Error('No active chat context');
      loaded.enabled = await isEnabled(loaded.character);
      Object.assign(loaded, await outputSettings(loaded.character));
      settingsState.debugEnabled = loaded.debugEnabled;
      drawInventory(loaded);
      await Risuai.showContainer(uiState.compactContainer ? 'floating' : 'fullscreen');
      const panel = document.querySelector('.itemx-panel');
      if (panel && uiState.panelOpen && !reducedMotion())
        panel.classList.add('itemx-plugin-panel-in');
    } catch (error) {
      uiState.panelOpen = false;
      uiState.status = '인벤토리 열기 오류';
      try {
        await Risuai.hideContainer();
      } catch {}
      fail('openInventory', error);
    }
  }
