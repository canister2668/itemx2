/* ITEMX ui panel owner. Concatenated inside the runtime closure. */
  function itemsOf(snapshot) {
    const reg = snapshot?.registry || ITEMXCore.newRegistry();
    return reg.order.map((id) => reg.items[id]).filter(Boolean);
  }

  function rootPageItems(loaded) {
    const all = itemsOf(loaded?.snapshot)
      .filter((item) => !ITEMXHistory.terminal('item', item))
      .filter(matches)
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
        ? ITEMXText("ui-panel.139", ITEMXCore.esc(entity.id))
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
    if (!panelDocument() || !loaded) return false;
    const detailItems = rootPageItems(loaded);
    for (let index = 0; index < detailItems.length; index += 1) {
      const selected = await panelDocument().querySelector(`#itemx2-detail-${index}:checked`);
      if (!selected) continue;
      const detail = await queryMainClass(`itemx2-root-detail-body-${index}`);
      if (detail) await detail.setInnerHTML(itemDetailHtml(detailItems[index]));
      return Boolean(detail);
    }
    return false;
  }

  function codexEntries(loaded, domain) {
    return ITEMXHistory.currentEntities(loaded, domain).filter(matches).slice(0, 60);
  }

  async function hydrateCheckedCodexDetail(domain, loaded) {
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
    if (!panelDocument()) return null;
    return (
      (await panelDocument().querySelector(`.x-risu-${className}`)) ||
      (await panelDocument().querySelector(`.${className}`))
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

  async function mountRootLoading(label = ITEMXText("ui-panel.138")) {
    if (!hostState.mainDoc) return false;
    await removeRootDrawer();
    const root = await hostState.mainDoc.createElement('div');
    await root.setAttribute('x-itemx2-drawer', 'owner');
    await root.setClassName('x-risu-itemx2-root-drawer x-risu-itemx2-booting');
    await root.setInnerHTML(
      ITEMXText("ui-panel.137", ITEMXCore.esc(label))
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
      const error = new Error(ITEMXText("ui-panel.136"));
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

  async function enrichPendingChat(ctx, chat) {
    // This derived update can share the transport write; no host mutation here.
    try {
      const settings = await outputSettings(ctx.character);
      if (!settings.encountersEnabled || !settings.lorebookEncounterEnabled) return chat;
      const entries = await lorebookEntries(ctx.key);
      const active = await context();
      if (!active || active.key !== ctx.key) return chat;
      const base = rebuildCodexWithLedger(chat, buildMessageEventLookup(chat));
      const scanned = ITEMXLorebook.scan(base, entries, ITEMXLorebook.read(chat));
      if (!scanned.result.enriched && !scanned.result.removed) return chat;
      return { ...chat, scriptstate: { ...chat.scriptstate, [ITEMX_LORE_KEY]: JSON.stringify(scanned.ledger) } };
    } catch (error) {
      // Optional enrichment must not prevent committing authoritative events.
      debugRecord('pending lore enrichment', error?.message || String(error));
      return chat;
    }
  }

  async function scanLorebookEncounters({ refresh = false, silent = false } = {}) {
    const pending = (async () => {
      const ctx = await context();
      if (!ctx) throw new Error(ITEMXText("ui-panel.135"));
      const entries = await lorebookEntries(ctx.key, { refresh });
      const active = await context();
      if (!active || active.key !== ctx.key) throw new Error(ITEMXText("ui-panel.134"));
      const scanResult = await (async () => {
        const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
        if (!latest) throw new Error(ITEMXText("ui-panel.133"));
        if (
          latest.isStreaming ||
          (latest.message || []).some((message) => message?.isStreaming || message?.bgContinue)
        ) {
          throw new Error(ITEMXText("ui-panel.132"));
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
        await saveChat(ctx.characterIndex, ctx.chatIndex, next, latest);
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
        uiState.status = ITEMXText("ui-panel.131", summary.enriched, summary.removed, summary.matched, summary.ambiguous);
      debugRecord('lorebook scan', summary);
      if (!silent)
        await notifyUser(
          ITEMXText("ui-panel.129", summary.enriched, summary.removed, summary.matched, summary.ambiguous ? ITEMXText("ui-panel.130", summary.ambiguous) : ''),
          'success'
        );
      return scanResult;
    })().catch(async (error) => {
      if (!silent) await notifyUser(ITEMXText("ui-panel.128", error.message || error), 'error');
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

  // Scroll completion may skip a closed drawer. It must not coalesce away a
  // full refresh scheduled by a host mutation while scrolling was active.
  function scheduleHostDomSync(delayMs = 320, { light = false } = {}) {
    workQueue.schedule(light ? 'hostLightSyncTimer' : 'hostSyncTimer', async () => {
      try {
        await installBodyEffectGovernor();
        if (!light || uiState.rootOpen) await ensureRootInventory();
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
        if (!text.includes(ITEMXText("ui-panel.127"))) continue;
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
    if (uiState.panelOpen) { if (!open) { uiState.rootOpen = false; await closeInventory(); } return; }
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
    clearScrollTimers();
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
      uiState.status = ITEMXText("ui-panel.126");
      return;
    }
    const cached = pipelineState.cachedLoaded;
    const replayChanged =
      !contextChanged &&
      cached?.key === active.key &&
      cached.replayFingerprint !== replaySourceFingerprint(active.chat);

    if (!contextChanged && (auxState.auxActive > 0 || workQueue.recent('host-settling', 1200) === active.key))
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
    const levelLabel = skill.level == null ? ITEMXText("ui-panel.125") : `Lv.${Number(skill.level)}`;
    const masteryLabel = knownMastery ? ITEMXText("ui-panel.124", Number(skill.mastery)) : ITEMXText("ui-panel.123");
    return ITEMXText("ui-panel.120", codexListFx('skill', skillFxClasses(skill, rarityMode)), ITEMXCore.esc(skillEmoji(skill)), ITEMXCore.esc(skill.name), ITEMXCore.esc(skill.rank), levelLabel, masteryLabel, ITEMXCore.esc(skill.type), ITEMXCore.esc(skill.status), skill.affinity ? `<i>${ITEMXCore.esc(skill.affinity)}</i>` : '', ITEMXCore.esc(skill.cost || ITEMXText("ui-panel.121")), ITEMXCore.esc(skill.cooldown || ITEMXText("ui-panel.122")), Array.from({ length: 5 }, (_, index) => `<i class="${index < filled ? 'on' : ''}"></i>`).join(''));
  }

  function skillPageHtml(skill, back, rarityMode = 'world') {
    const knownMastery = skill.mastery != null && Number.isFinite(Number(skill.mastery));
    const mastery = knownMastery ? Math.max(0, Math.min(10, Math.ceil(Number(skill.mastery) / 10))) : 0;
    const levelLabel = skill.level == null ? ITEMXText("ui-panel.119") : `Lv.${Number(skill.level)}`;
    const masteryLabel = knownMastery ? `${Number(skill.mastery)}%` : ITEMXText("ui-panel.118");
    const effects = (skill.effects || []).map((one) => `<i>${ITEMXCore.esc(one)}</i>`).join('') || ITEMXText("ui-panel.117");
    const affinity = skillTheme(skill),
      tier = skillRankTier(skill.rank, rarityMode);
    const fx = ITEMXRenderer.renderSkillFx({ ...skill, affinity }, tier, presentationState.visualEffectsEnabled ? 'full' : 'off');
    const vars = ITEMXRenderer.itemVars({ id: skill.id, name: skill.name, theme: 'arcane', rarity: tier, affinity });
    return ITEMXText("ui-panel.109", back, skillFxClasses(skill, rarityMode), vars, fx, ITEMXCore.esc(skillEmoji(skill)), ITEMXCore.esc(skill.name), ITEMXCore.esc(skill.rank), ITEMXCore.esc(skill.school || ITEMXText("ui-panel.110")), ITEMXCore.esc(skill.status), levelLabel, ITEMXCore.esc(skill.type || ITEMXText("ui-panel.111")), ITEMXCore.esc(skill.target || ITEMXText("ui-panel.112")), ITEMXCore.esc(skill.cost || ITEMXText("ui-panel.113")), ITEMXCore.esc(skill.cooldown || ITEMXText("ui-panel.114")), masteryLabel, Array.from({ length: 10 }, (_, index) => `<i class="${index < mastery ? 'on' : ''}"></i>`).join(''), skill.description ? ITEMXText("ui-panel.115", ITEMXCore.esc(skill.description)) : '', effects, ITEMXCore.esc(skill.growth || ITEMXText("ui-panel.116")), ITEMXCore.esc(skill.id), detailAnnotations('skill', skill));
  }

  function monsterSummaryHtml(monster, portrait = '') {
    const visual = portrait
      ? `<img src="${ITEMXCore.esc(portrait)}" alt="">`
      : `<span class="itemx2-codex-glyph">${ITEMXCore.esc(encounterEmoji(monster))}</span>`;
    return ITEMXText("ui-panel.107", codexListFx('encounter', encounterFxClasses(monster)), visual, ITEMXCore.esc(monster.name), ITEMXCore.esc(monster.kind), ITEMXCore.esc(monster.threat), ITEMXCore.esc(monster.status), ITEMXCore.esc(monster.relation), (
      monster.weaknesses || []
    )
      .slice(0, 2)
      .map((one) => ITEMXText("ui-panel.108", ITEMXCore.esc(one)))
      .join(''), monster.active ? '⚔️' : '📖');
  }

  function monsterPageHtml(monster, portrait, back) {
    const visual = portrait
      ? `<img class="itemx-monster-portrait" src="${ITEMXCore.esc(portrait)}" alt="">`
      : `<span class="itemx-codex-hero-glyph">${ITEMXCore.esc(encounterEmoji(monster))}</span>`;
    const chips = (label, values, fallback) =>
      `<section class="itemx-codex-section"><h4>${label}</h4><span class="itemx-codex-chip-row">${(values || []).map((one) => `<i>${ITEMXCore.esc(one)}</i>`).join('') || `<i>${fallback}</i>`}</span></section>`;
    const outcomeLabels = { ended: ITEMXText("ui-panel.106"), escaped: ITEMXText("ui-panel.105"), defeated: ITEMXText("ui-panel.104"), dead: ITEMXText("ui-panel.103"), unknown: ITEMXText("ui-panel.102") };
    const outcomeStatus = themeText(monster.outcomeStatus || monster.status);
    const outcome = monster.outcome
      ? ITEMXText("ui-panel.099", ITEMXCore.esc(outcomeLabels[outcomeStatus] || ITEMXText("ui-panel.100")), monster.outcomeEncounter ? ITEMXText("ui-panel.101", Number(monster.outcomeEncounter)) : '', ITEMXCore.esc(monster.outcome))
      : '';
    const lore = monster._lore
      ? ITEMXText("ui-panel.098")
      : '';
    return ITEMXText("ui-panel.084", back, encounterFxClasses(monster), codexHeroFx('encounter'), ITEMXCore.esc(monster.threat || ITEMXText("ui-panel.085")), visual, ITEMXCore.esc(monster.name), ITEMXCore.esc(monster.kind || ITEMXText("ui-panel.086")), ITEMXCore.esc(monster.relation), ITEMXCore.esc(monster.status), Number(monster.encounterCount) || 1, monster.active ? ITEMXText("ui-panel.088") : ITEMXText("ui-panel.087"), outcome, monster.description ? ITEMXText("ui-panel.089", ITEMXCore.esc(monster.description)) : '', chips(ITEMXText("ui-panel.091"), monster.aliases, ITEMXText("ui-panel.090")), chips(ITEMXText("ui-panel.093"), monster.weaknesses, ITEMXText("ui-panel.092")), chips(ITEMXText("ui-panel.095"), monster.resistances, ITEMXText("ui-panel.094")), chips(ITEMXText("ui-panel.097"), monster.moves, ITEMXText("ui-panel.096")), lore, ITEMXCore.esc(monster.id), detailAnnotations('monster', monster));
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
        ? ITEMXText("ui-panel.083")
        : ITEMXText("ui-panel.082");
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
      ? ITEMXText("ui-panel.081", ITEMXCore.esc(hostState.update.latest))
      : '';
    return `<div class="itemx2-native-badge" x-itemx2-badge="launcher" aria-label="ITEMX CODEX"><img src="${ITEMX_BADGE_ICON}" alt="ITEMX CODEX">${update}</div><div class="itemx2-aux-status ${auxState.auxActive > 0 ? 'itemx2-aux-status-on' : ''}" aria-live="polite"><i></i><span class="itemx2-aux-status-label">${ITEMXCore.esc(auxWorkingLabel())}</span></div><div class="itemx2-feedback" role="status" aria-live="polite"></div>`;
  }

  const updateLabelHtml = () =>
    hostState.update.available
      ? `<span class="itemx2-update-label" x-itemx2-update="${ITEMXCore.esc(hostState.update.latest)}">UPDATE</span>`
      : '';

  // The power toggle lives here rather than in settings: it is per bot, and a
  // bot that does not want an item codex wants it off from the first message.
  // Leaving it on costs about 2,900 tokens of protocol on every request.
  function panelMenuHtml(native = true, enabled = true) {
    return ITEMXText(
      "ui-panel.080",
      enabled ? ' itemx2-power-on' : '',
      enabled ? 'true' : 'false',
      native ? 'itemx2-root-close' : ''
    );
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
      ['recent', ITEMXText("ui-panel.079")],
      ...(view.domain === 'item'
        ? [
            ['consume', ITEMXText("ui-panel.078")],
            ['loss', ITEMXText("ui-panel.077")]
          ]
        : []),
      ['kept', ITEMXText("ui-panel.076")],
      ['archived', ITEMXText("ui-panel.075")]
    ];
    const buttons = (row, index) =>
      `<div class="itemx2-history-actions"><button class="itemx2-history-keep-${index}" type="button">${row.kept ? ITEMXText("ui-panel.074") : ITEMXText("ui-panel.073")}</button>${!row.kept && !row.archived && row.cycle ? ITEMXText("ui-panel.072", index) : ''}</div>`;
    const label = (row) =>
      row.kept
        ? ITEMXText("ui-panel.071")
        : row.archived
          ? ITEMXText("ui-panel.070")
          : row.automatic && row.remaining !== null
            ? ITEMXText("ui-panel.069", row.remaining)
            : row.domain === 'item'
              ? ITEMXText("ui-panel.068")
              : row.domain === 'skill'
                ? ITEMXText("ui-panel.067")
                : ITEMXText("ui-panel.066");
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
    return ITEMXText("ui-panel.058", selected ? ITEMXText("ui-panel.060") : ITEMXText("ui-panel.059"), { item: ITEMXText("ui-panel.063"), skill: ITEMXText("ui-panel.062"), monster: ITEMXText("ui-panel.061") }[view.domain], filters.map(([key, label]) => `<button class="itemx2-history-filter-${key} ${view.filter === key ? 'itemx2-history-filter-on' : ''}" type="button">${label}</button>`).join(''), prefs.after ? ITEMXText("ui-panel.064", prefs.after) : 'OFF', selected ? detail : cards || ITEMXText("ui-panel.065"), !selected && pages > 1 ? `<footer class="itemx2-history-actions"><button class="itemx2-history-prev" type="button">‹</button><span>${view.page + 1} / ${pages}</span><button class="itemx2-history-next" type="button">›</button></footer>` : '');
  }

  async function saveHistoryPreference(loaded, update) {
    await (async () => {
      const active = await context();
      if (!active || active.key !== loaded.key) throw new Error(ITEMXText("ui-panel.057"));
      const latest = await readChat(active.characterIndex, active.chatIndex);
      if (!latest) throw new Error(ITEMXText("ui-panel.056"));
      if (latest?.isStreaming || latest?.message?.some((message) => message.isStreaming))
        throw new Error(ITEMXText("ui-panel.055"));
      const prefs = ITEMXHistory.preferences(latest);
      update(prefs);
      const next = { ...latest, scriptstate: { ...latest.scriptstate, [ITEMXHistory.KEY]: JSON.stringify(prefs) } };
      await saveChat(active.characterIndex, active.chatIndex, next, latest);
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
      pane = await panelDocument().createElement('section');
      await pane.addClass('x-risu-itemx2-history-pane');
      await body.appendChild(pane);
    }
    await pane.setInnerHTML(historyHtml(loaded));
    await body.addClass('x-risu-itemx2-history-opened');
  }

  async function drawIframeHistory(loaded) { return drawRootHistory(loaded); }

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

  function searchControlsHtml() {
    return ITEMXText("ui-panel.054", ITEMXCore.esc(ui.query));
  }

  function rootInventoryHtml(loaded, open = true, tab = 'inventory') {
    if (!open)
      return ITEMXText("ui-panel.053", rootBadgeHtml());
    const all = itemsOf(loaded.snapshot)
      .filter((item) => tab === 'settings' || (!ITEMXHistory.terminal('item', item) && matches(item)))
      .slice(0, 60);
    const pageCount = Math.max(1, Math.ceil(all.length / ITEMX_ROOT_PAGE_SIZE));
    uiState.rootItemPage = Math.max(0, Math.min(pageCount - 1, uiState.rootItemPage));
    const pageStart = uiState.rootItemPage * ITEMX_ROOT_PAGE_SIZE;
    const inventoryPage = tab === 'inventory' ? all.slice(pageStart, pageStart + ITEMX_ROOT_PAGE_SIZE) : [];
    const skills = (loaded.codexSnapshot?.skills?.order || [])
      .map((id) => loaded.codexSnapshot.skills.entries[id])
      .filter(Boolean)
      .filter((entity) => !ITEMXHistory.terminal('skill', entity))
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
      ['all', ITEMXText("ui-panel.052")],
      ['owned', ITEMXText("ui-panel.051")],
      ['equipped', ITEMXText("ui-panel.050")],
      ['observed', ITEMXText("ui-panel.049")]
    ];
    const controls = filters
      .map(
        ([key]) =>
          `<input class="itemx2-root-control itemx2-root-filter-${key}" id="itemx2-filter-${key}" name="itemx2-filter" type="radio" ${key === 'all' ? 'checked' : ''}>`
      )
      .join('');
    // CSS-only, like the tab radios: the header label flips this and the search
    // bar appears. No proxy round-trip, and the bar costs no height until asked.
    const searchToggle =
      `<input class="itemx2-root-control itemx2-search-toggle" id="itemx2-search-toggle" type="checkbox"${ui.query ? ' checked' : ''}>`;
    const skillList =
      tab === 'skills'
        ? skills
            .map(
              (skill, index) =>
                ITEMXText("ui-panel.048", index, index, skillSummaryHtml(skill, loaded.rarityMode), index, index)
            )
            .join('') || ITEMXText("ui-panel.047")
        : '';
    const monsterList =
      tab === 'bestiary'
        ? monsters
            .map((monster, index) => {
              const portrait = loaded.portraits?.[monster.id] || '';
              return ITEMXText("ui-panel.046", index, monster.active ? 'active' : '', index, monsterSummaryHtml(monster, portrait), index, index);
            })
            .join('') || ITEMXText("ui-panel.045")
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
              return ITEMXText("ui-panel.044", classes, detailId, index, detailId, tile, index);
            })
            .join('') || ITEMXText("ui-panel.043")
        : '';
    const enabled = loaded.enabled === true;
    const skin = SETTINGS_SKINS.native;
    const positionChoices = tab === 'settings' ? settingsPositionChoices(skin) : '';
    const fontChoices = tab === 'settings' ? settingsFontChoices(loaded, skin) : '';
    const domainControls = settingsDomainControls(loaded, skin);
    // Phase timings go above the log: they are what a stutter report needs. Only
    // with debug on, so the panel a reader normally sees is unchanged.
    const debugLog = loaded.debugEnabled
      ? `-- phase cost --\n${phaseReport()}\n\n${settingsDebugLog()}`
      : settingsDebugLog();
    const storageParts = settingsStorageParts(loaded);
    // A map of the screen beats six abbreviations: the slot sits where the badge will.
    const managerRows =
      tab === 'settings'
        ? all
            .map(
              (item, index) =>
                ITEMXText("ui-panel.042", index, ITEMXCore.esc(ITEMXCore.resolveItemEmoji(item)), ITEMXCore.esc(item.name), ITEMXCore.esc(item.displayRarity || item.rarity), ITEMXCore.esc(item.possession), ITEMXCore.esc(item.location), index, index, item.possession === 'removed' ? 'disabled' : '')
            )
            .join('') || ITEMXText("ui-panel.041")
        : '';
    const manager = ITEMXText("ui-panel.040", managerRows);
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
    const debugPanel = ITEMXText("ui-panel.037", loaded.debugEnabled ? ITEMXText("ui-panel.038") : 'OFF', loaded.debugEnabled ? 'itemx2-setting-on' : '', loaded.debugEnabled ? 'ON' : 'OFF', ITEMXCore.esc(loaded.key), pipelineState.generation, ITEMXCore.esc(loaded.snapshot.fingerprint || '-'), ITEMXCore.esc(loaded.codexSnapshot.fingerprint || '-'), counts.all, skills.length, monsters.length, ITEMXCore.esc(hostState.lastHookError || hostState.lastDomError || ITEMXText("ui-panel.039")), ITEMXCore.esc(debugLog));
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
    const inventoryContent = ITEMXText("ui-panel.033", filters.map(([key, label]) => `<label class="itemx-seg-i" for="itemx2-filter-${key}">${label} <span class="itemx-seg-n">${counts[key]}</span></label>`).join(''), loaded.effectsEnabled ? ITEMXText("ui-panel.035") : ITEMXText("ui-panel.034"), list, all.length ? `${pageStart + 1}-${shownEnd}` : '0', all.length, itemsOf(loaded.snapshot).length > 60 ? ITEMXText("ui-panel.036") : '', pager);
    const skillsContent = ITEMXText("ui-panel.032", skillList);
    const bestiaryContent = ITEMXText("ui-panel.031", monsterList);
    const activeContent =
      tab === 'skills'
        ? skillsContent
        : tab === 'bestiary'
          ? bestiaryContent
          : tab === 'settings'
            ? settings
            : inventoryContent;
    const tabs = [
      ['inventory', ITEMXText("ui-panel.030")],
      ['skills', ITEMXText("ui-panel.029")],
      ['bestiary', ITEMXText("ui-panel.028")],
      ['settings', ITEMXText("ui-panel.027")]
    ]
      .map(
        ([key, label]) =>
          `<button class="itemx-main-tab itemx2-root-tab-${key} ${tab === key ? 'itemx-main-tab-on' : ''}" type="button">${label}</button>`
      )
      .join('');
    const headerStatus = `${enabled ? ITEMXText("ui-panel.026", counts.owned, counts.equipped, counts.observed) : ITEMXText("ui-panel.025")} · ${ITEMXCore.esc(uiState.status)}`;
    return `${controls}${searchToggle}${rootBadgeHtml()}<div class="itemx2-root-layer"><section class="itemx-panel itemx2-root-panel" aria-label="ITEMX CODEX"><input class="itemx2-root-control" id="itemx2-detail-none" name="itemx2-detail" type="radio" checked><header class="itemx-ph"><span class="itemx-ph-text"><span class="itemx-ph-eyebrow">ITEMX CODEX · ${ITEMX_VERSION_LABEL}${updateLabelHtml()}</span><span class="itemx-ph-title">${ITEMXCore.esc(loaded.character.name || ITEMXText("ui-panel.024"))}</span><span class="itemx-ph-sub"><!--ITEMX2-HEADER-START-->${headerStatus}<!--ITEMX2-HEADER-END--></span></span>${panelMenuHtml(true, enabled)}</header><nav class="itemx-main-tabs"><!--ITEMX2-NAV-START-->${tabs}<!--ITEMX2-NAV-END--></nav>${frozenBannerHtml(true)}<div class="itemx2-root-tab-body"><!--ITEMX2-BODY-START-->${tab === 'settings' ? '' : searchControlsHtml()}${activeContent}<!--ITEMX2-BODY-END--></div></section></div>`;
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
        const close = panelDocument() && (await panelDocument().querySelector('.x-risu-itemx2-root-close'));
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
        if (await eventHitsMainClass(event, 'itemx2-search-apply') || await eventHitsMainClass(event, 'itemx2-search-clear')) {
          const clear = await eventHitsMainClass(event, 'itemx2-search-clear');
          const input = await queryMainClass('itemx2-search-query');
          ui.query = clear ? '' : String(await input?.textContent() || '').trim().slice(0, 200);
          uiState.rootItemPage = 0;
          await openRootInventory({ open: true, tab: uiState.activeRootTab });
          return;
        }
        // Header actions are handled before tab and body controls.
        if (await eventHitsMainClass(event, 'itemx2-history-open')) {
          await routeHistoryControls(event);
          return;
        }
        for (const [tab, label] of [
          ['inventory', ITEMXText("ui-panel.023")],
          ['skills', ITEMXText("ui-panel.022")],
          ['bestiary', ITEMXText("ui-panel.021")],
          ['settings', ITEMXText("ui-panel.020")]
        ]) {
          const button = panelDocument() && (await panelDocument().querySelector(`.x-risu-itemx2-root-tab-${tab}`));
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
            const body = panelDocument() && (await panelDocument().querySelector('.x-risu-itemx2-root-tab-body'));
            if (body) {
              await body.removeClass('x-risu-itemx2-history-opened');
              await body.setInnerHTML(
                ITEMXText("ui-panel.019", label)
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
          const button = panelDocument() && (await panelDocument().querySelector(selector));
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
            const body = panelDocument() && (await panelDocument().querySelector('.x-risu-itemx2-root-tab-body'));
            if (body)
              await body.setInnerHTML(
                ITEMXText("ui-panel.018")
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
              if (!(await panelDocument().querySelector(`#itemx2-detail-${index}:checked`))) continue;
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
        const managerFold = panelDocument() && (await panelDocument().querySelector('.x-risu-itemx2-manager-fold'));
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
                  uiState.status = note ? ITEMXText("ui-panel.017") : ITEMXText("ui-panel.016");
                  try {
                    const itemEvent = await runItemModel('reroll', loaded, target, note);
                    await commitManualEvents(loaded, [itemEvent], note ? ITEMXText("ui-panel.015") : ITEMXText("ui-panel.014"));
                  } catch (error) {
                    uiState.status = ITEMXText("ui-panel.013");
                    await notifyUser(`ITEMX CODEX: ${error.message || error}`, 'error');
                  }
                  await openRootInventory({ open: true, tab: 'settings' });
                  return;
                }
                if (await eventHitsMainClass(event, `itemx2-manager-remove-${index}`)) {
                  if (target.possession === 'removed') return;
                  if (!(await confirmUser(ITEMXText("ui-panel.012", target.name)))) return;
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
                    await commitManualEvents(loaded, [itemEvent], ITEMXText("ui-panel.011"));
                  } catch (error) {
                    uiState.status = ITEMXText("ui-panel.010");
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
                  await notifyUser(ITEMXText("ui-panel.009"), 'error');
                  return;
                }
                uiState.status = ITEMXText("ui-panel.008");
                try {
                  const itemEvent = await runItemModel('create', loaded, null, createNote);
                  await commitManualEvents(loaded, [itemEvent], ITEMXText("ui-panel.007"));
                } catch (error) {
                  uiState.status = ITEMXText("ui-panel.006");
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
    if (uiState.panelOpen) {
      const loaded = options.loaded || await cachedOrRebuildCurrent();
      if (loaded) await drawInventory(loaded, options.tab || uiState.activeRootTab);
      return;
    }
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
        uiState.status = ITEMXText("ui-panel.005");
        await notifyUser(ITEMXText("ui-panel.004"), 'error');
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
      uiState.status = ITEMXText("ui-panel.003");
      await removeRootDrawer();
      fail('openRootInventory', error);
    }
  }

  function matches(item) {
    const q = ui.query.trim().toLocaleLowerCase();
    return (
      !q ||
      [item.name, item.id, item.itemType, item.displayRarity, item.affinity, item.affinity2, item.school, item.kind].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(q)
      )
    );
  }

  async function drawInventory(loaded, tab = uiState.activeRootTab) {
    const root = document.querySelector('#itemx2-root');
    if (!root) return;
    uiState.activeRootTab = tab;
    uiState.rootOpen = true;
    root.className = `itemx2-root-drawer itemx2-frame itemx2-is-open itemx2-font-${loaded.fontScale || 'small'}${loaded.effectsEnabled ? '' : ' itemx2-effects-off'}${SKIN_NAMES.includes(loaded.skin) ? ` itemx2-skin-${loaded.skin}` : ''}`;
    root.innerHTML = rootInventoryHtml(loaded, true, tab);
    await drawRootHistory(loaded);
    await installRootClickRouter(nativeElement(root));
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
    uiState.activeRootTab = tab;
    try {
      const compact = window.innerWidth <= 520;
      const panelWidth = compact ? Math.max(320, window.innerWidth - 32) : 420;
      const panelHeight = Math.max(420, Math.min(700, Math.round(window.innerHeight * (compact ? 0.72 : 0.78))));
      uiState.compactContainer = true;
      try {
        await Risuai.resizeContainer(panelHeight, panelWidth);
      } catch (error) {
        uiState.compactContainer = false;
        uiState.status = ITEMXText("ui-panel.002");
        log('resizeContainer unavailable; using bounded fullscreen fallback');
      }
      document.head.innerHTML = fallbackDocumentHead();
      document.body.innerHTML = '<div id="itemx2-root"></div>';
      const loaded = await rebuildCurrent();
      if (!loaded) throw new Error('No active chat context');
      loaded.enabled = await isEnabled(loaded.character);
      Object.assign(loaded, await outputSettings(loaded.character));
      settingsState.debugEnabled = loaded.debugEnabled;
      await drawInventory(loaded, tab);
      await Risuai.showContainer(uiState.compactContainer ? 'floating' : 'fullscreen');
      const panel = document.querySelector('.itemx-panel');
      if (panel && uiState.panelOpen && !reducedMotion())
        panel.classList.add('itemx-plugin-panel-in');
    } catch (error) {
      uiState.panelOpen = false;
      uiState.status = ITEMXText("ui-panel.001");
      try {
        await Risuai.hideContainer();
      } catch {}
      fail('openInventory', error);
    }
  }
