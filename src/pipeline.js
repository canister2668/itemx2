/* ITEMX pipeline owner. Concatenated inside the runtime closure. */
  async function withTimeout(promise, timeoutMs, message) {
    let timer = null;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs);
        })
      ]);
    } finally {
      if (timer) globalThis.clearTimeout(timer);
    }
  }

  async function context() {
    try {
      const [characterIndex, chatIndex, character] = await Promise.all([
        Risuai.getCurrentCharacterIndex(),
        Risuai.getCurrentChatIndex(),
        Risuai.getCharacter()
      ]);
      if (characterIndex == null || chatIndex == null || !character) return null;
      const chat = await readChat(characterIndex, chatIndex);
      if (!chat) return null;
      return {
        characterIndex,
        chatIndex,
        character,
        chat,
        key: `${character.chaId || characterIndex}:${chat.id || chatIndex}`
      };
    } catch (error) {
      // PocketRisu has no current chatPage on Home. A globally loaded plugin
      // must treat that route as an idle state, not as an initialization error.
      if (!/chatPage|current chat|undefined/i.test(String(error?.message || error))) fail('active chat context', error);
      return null;
    }
  }

  function itemxProtocolText(rarityMode = 'world') {
    const policy =
      rarityMode === 'itemx'
        ? `## ITEMX Rarity Policy: FORCED\nITEMX rarity is an internal relative power and visual tier, not necessarily the world's printed grade name. Preserve the setting's local grade wording in display. An explicit user-requested ITEMX tier always wins. When the narrative conclusively establishes a newly appraised item as the setting's absolute highest grade, ultimate pinnacle, server/world-unique apex, or beyond the existing grade system, emit rarity=empyrean even if the setting calls that grade Epic; keep the local wording and distinction in display. Use mythical or legendary for clearly lower relative standings. Do not promote from ornate prose alone: the apex standing must be settled by the narrative.`
        : `## ITEMX Rarity Policy: WORLD FIRST\nTreat the setting's literal item grade as authoritative. Map its stated grade to the nearest literal ITEMX rarity and do not promote it merely because it is described as the setting's best. Preserve the local grade wording in display.`;
    return `${ITEMX_PROTOCOL_TEXT}\n\n${policy}`;
  }

  const enabledCodexDomains = (settings) =>
    [settings.skillsEnabled && 'skill', settings.encountersEnabled && 'monster'].filter(Boolean);

  const stripItemTransport = (content) =>
    ITEMXCore.extractResponse(String(content || ''), ITEMXCore.newRegistry()).content.replace(ITEMXCore.MARKER_RE, '');

  const stripAllTransport = (content) =>
    ITEMXCodex.extractResponse(stripItemTransport(content), ITEMXCodex.snapshot(), {
      enabledDomains: []
    }).content.replace(ITEMXCodex.MARKER_RE, '');

  const OWNED_TRANSPORT_HINT_RE =
    /<!--(?:ITEMX2|CODEX2)(?::|@)|<\/?(?:itemExam|itemPatch|itemx|skillExam|skillPatch|monsterExam|monsterPatch)\b|\[(?:itemx|아이템)\s*:/i;

  function processTransportStripper(content) {
    const source = ITEMXCore.stripInventoryEcho(content);
    if (!OWNED_TRANSPORT_HINT_RE.test(source)) return source;
    return stripAllTransport(source)
      .replace(ITEMX_REF_RE, '')
      .replace(ITEMX_CODEX_REF_RE, '')
      .replace(/\[(?:itemx|아이템)\s*:[^\]\r\n]{0,2048}\]/gi, '');
  }

  function protocolForSettings(settings, character, moduleAssets = [], options = {}) {
    const parts = [];
    if (settings.itemsEnabled) parts.push(itemxProtocolText(settings.rarityMode));
    const domains = enabledCodexDomains(settings);
    if (domains.length) {
      const portraitRows = domains.includes('monster')
        ? combinedPortraitAssets(character, moduleAssets, ITEMXCodex.ASSET_CATALOG_MAX)
        : [];
      const names = ITEMXCodex.portraitProtocolNames(portraitRows, {
        narrative: options.narrative || '',
        entities: options.entities || [],
        max: ITEMXCodex.PORTRAIT_PROTOCOL_MAX
      });
      parts.push(ITEMXCodex.protocol(names, { enabledDomains: domains, rarityMode: settings.rarityMode }));
    }
    return parts.join('\n\n');
  }

  function mainRequestType(type) {
    return !/(translate|emotion|memory|otherax|aux|submodel|image|tts)/i.test(String(type || ''));
  }

  function requestEndsWithModelTurn(messages) {
    if (!Array.isArray(messages) || !messages.length) return false;
    const last = messages[messages.length - 1] || {};
    const role = String(last.role || '').trim();
    // Risu's Google formatter handles multimodal messages before its normal
    // role switch and maps every non-user multimodal turn to Gemini `model`.
    if (Array.isArray(last.multimodals) && last.multimodals.length > 0) {
      return !/^(?:user|human)$/i.test(role);
    }
    return /^(?:assistant|model|char)$/i.test(role);
  }

  function injectRequestProtocol(messages, instruction) {
    const protocol = { role: 'system', content: instruction, name: 'ITEMX_2_PROTOCOL' };
    // Risu's Google formatter converts a non-leading system turn following a
    // model turn into a user turn. This preserves continuation semantics while
    // satisfying Gemini's requirement that requests never end with model.
    return requestEndsWithModelTurn(messages) ? [...messages, protocol] : [protocol, ...messages];
  }

  function anchorText(value) {
    return String(value || '')
      .toLocaleLowerCase()
      .replace(/[\s\p{P}\p{S}]+/gu, '');
  }

  function positionMarkersByNarrative(content) {
    // Planning is not visible narrative. A name mentioned there must never
    // pull a committed card out of the response body.
    const protectedResult = ITEMXCore.protectPlanning(content, (masked) => ({
      content: positionMarkersByNarrative(masked)
    }));
    if (protectedResult) return protectedResult.content;
    const source = String(content || '');
    const markers = [];
    source.replace(ITEMXCore.MARKER_RE, (_, code, index) => {
      const payload = ITEMXCore.decodePayload(code);
      markers.push({ code, payload, prefix: 'ITEMX2', index });
      return '';
    });
    source.replace(ITEMXCodex.MARKER_RE, (_, code, index) => {
      const payload = ITEMXCodex.decodePayload(code);
      markers.push({ code, payload, prefix: 'CODEX2', index });
      return '';
    });
    markers.sort((a, b) => a.index - b.index);
    if (!markers.length) return source;

    const narrative = source.replace(ITEMXCore.MARKER_RE, '').replace(ITEMXCodex.MARKER_RE, '').trimEnd();
    const pieces = narrative.split(/(\n{2,})/);
    const placements = new Map();
    const trailerIndex = pieces.findIndex(
      (piece, index) =>
        index % 2 === 0 && /^\s*(?:\[(?:status|state|route)\b|<(?:state|status|route|risu[-_]))/i.test(piece)
    );
    for (const marker of markers) {
      const item =
        marker.prefix === 'ITEMX2'
          ? marker.payload?.event?.kind === 'exam'
            ? marker.payload.event.item
            : marker.payload?.view
          : marker.payload?.view || marker.payload?.event?.entity;
      const name = String(item?.name || '').trim();
      const exact = anchorText(name);
      const terms = name
        .split(/[\s·:()\[\]{}〈〉《》「」『』/\\,_-]+/u)
        .map(anchorText)
        .filter((term) => term.length >= 2);
      let bestIndex = -1,
        bestScore = 0;
      for (let index = 0; index < pieces.length; index += 2) {
        const paragraph = anchorText(pieces[index]);
        if (!paragraph) continue;
        const exactHit = exact.length >= 2 && paragraph.includes(exact);
        const hits = terms.filter((term) => paragraph.includes(term)).length;
        const enoughTerms = terms.length > 1 ? hits >= Math.min(2, terms.length) : hits === 1;
        if (!exactHit && !enoughTerms) continue;
        const score = (exactHit ? 10000 : 0) + hits * 100;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
      if (bestIndex < 0) {
        const prefixText = source
          .slice(0, marker.index)
          .replace(ITEMXCore.MARKER_RE, '')
          .replace(ITEMXCodex.MARKER_RE, '');
        bestIndex = Math.min(Math.max(0, (prefixText.split(/\n{2,}/).length - 1) * 2), Math.max(0, pieces.length - 1));
        if (bestIndex % 2) bestIndex -= 1;
        if (trailerIndex >= 0 && bestIndex >= trailerIndex) bestIndex = Math.max(0, trailerIndex - 2);
      }
      if (trailerIndex >= 0 && bestIndex >= trailerIndex) bestIndex = Math.max(0, trailerIndex - 2);
      const list = placements.get(bestIndex) || [];
      list.push(marker);
      placements.set(bestIndex, list);
    }
    for (const [index, rows] of placements) {
      pieces[index] =
        `${pieces[index].trimEnd()}\n\n${rows.map((row) => `<!--${row.prefix}:${row.code}-->`).join('\n')}`;
    }
    let positioned = pieces.join('').trimEnd();
    return positioned;
  }

  function scheduleLegacyCommitRecovery(confirm = false) {
    if (auxState.auxActive > 0) return;
    workQueue.clearTimer('legacyCommitTimer');
    workQueue.schedule(
      'legacyCommitTimer',
      async () => {
        try {
          await catchUpLatestOutput({ syncUi: false });
          const loaded = await rebuildCurrent();
          if (loaded) commitEventBursts(loaded.chat);
          if (loaded?.encountersEnabled && loaded?.lorebookEncounterEnabled)
            await scanLorebookEncounters({ silent: true });
          await ensureRootInventory();
          if (!confirm && auxState.auxActive === 0) scheduleLegacyCommitRecovery(true);
        } catch (error) {
          fail('legacy commit recovery', error);
        }
      },
      1800,
      false
    );
  }

  async function repairCommittedTransport(ctx, index, source) {
    if (assertLogReadable(ctx?.chat)) return null;
    const settings = await outputSettings(ctx.character);
    const lookup = buildMessageEventLookup(ctx.chat);
    const base = rebuildWithManual(ctx.chat, lookup).registry;
    const parsed = settings.itemsEnabled
      ? ITEMXCore.extractResponse(source, base)
      : { content: stripItemTransport(source), events: [], errors: [] };
    const codexBase = rebuildCodexWithLedger(ctx.chat, lookup, { rarityMode: settings.rarityMode });
    const codexParsed = ITEMXCodex.extractResponse(parsed.content, codexBase, {
      enabledDomains: enabledCodexDomains(settings),
      rarityMode: settings.rarityMode,
      skillEvidenceText: source
    });
    const positioned = positionMarkersByNarrative(codexParsed.content);
    const needsCompaction = ITEMXCore.MARKER_RE.test(positioned) || ITEMXCodex.MARKER_RE.test(positioned);
    ITEMXCore.MARKER_RE.lastIndex = 0;
    ITEMXCodex.MARKER_RE.lastIndex = 0;
    if (positioned === source && !needsCompaction) return { ctx, source };
    const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
    if (!latest || ITEMXCore.fnv1a(messageData(latest.message?.[index])) !== ITEMXCore.fnv1a(source)) return null;
    const next = ITEMXCore.clone(latest);
    const message = next.message?.[index];
    if (typeof message?.data === 'string') message.data = positioned;
    else if (typeof message?.content === 'string') message.content = positioned;
    else return null;
    const compacted = compactMessageTransports(next, index).chat;
    const compactedSource = messageData(compacted.message?.[index]);
    const compactedLookup = buildMessageEventLookup(compacted);
    const snapshot = rebuildWithManual(compacted, compactedLookup);
    const stillActive = pipelineState.activeContextKey === ctx.key;
    if (stillActive) {
      refreshLatest(compacted, compactedLookup);
      workQueue.remember('render', '');
      pipelineState.cachedLoaded = null;
      pipelineState.generation += 1;
      workQueue.remember('host-settling', ctx.key);
    }
    await saveChat(ctx.characterIndex, ctx.chatIndex, ITEMXCore.writeSnapshot(compacted, snapshot));
    const errors = parsed.errors.length + codexParsed.errors.length,
      events = parsed.events.length + codexParsed.events.length;
    if (stillActive) uiState.status = errors ? ITEMXText("pipeline.010", errors) : ITEMXText("pipeline.009", events);
    return { ctx: { ...ctx, chat: compacted }, source: compactedSource };
  }

  async function catchUpLatestOutput({ syncUi = true } = {}) {
    if (!pipelineState.activeContextKey || auxState.auxActive > 0 || presentationState.bodyFxScrollActive)
      return;
    let ctx = await context();
    if (!ctx || !(await isEnabled(ctx.character))) return;
    const index = assistantMessageIndex(ctx.chat);
    if (index < 0) return;
    let source = messageData(ctx.chat.message[index]);
    if (!automaticAuxReady(ctx.chat, index, source)) return;
    if (!automaticAuxSettled(ctx, index, source)) return;
    const repaired = await repairCommittedTransport(ctx, index, source);
    if (!repaired) return;
    source = repaired.source;
    ctx = repaired.ctx;
    if (pipelineState.activeContextKey !== ctx.key) return;
    // The guard must survive our own rewrite. recoverAuxiliaryOutput commits a new
    // message body, so a body-derived hash invalidates itself and the next open of
    // the same chat re-runs recovery forever. Anchor on the stable message id.
    const messageId = ctx.chat.message?.[index]?.chatId || `idx-${index}`;
    const fingerprint = `${ctx.key}:${index}:msg-${messageId}`;
    const attempt = await workQueue.attempt('catch-up', fingerprint,
      () => recoverAuxiliaryOutput({ messageIndex: index }), Array.isArray);
    if (attempt.skipped) return;
    if (syncUi) {
      const loaded = await rebuildCurrent();
      if (loaded) commitEventBursts(loaded.chat);
      if (loaded?.encountersEnabled && loaded?.lorebookEncounterEnabled) await scanLorebookEncounters({ silent: true });
      await ensureRootInventory();
    }
  }

  function scheduleCommittedOutputSync() {
    return dispatch('committed-output', async () => {
      await catchUpLatestOutput({ syncUi: false });
      const loaded = await rebuildCurrent();
      if (loaded) commitEventBursts(loaded.chat);
      if (loaded?.encountersEnabled && loaded?.lorebookEncounterEnabled) await scanLorebookEncounters({ silent: true });
      await ensureRootInventory();
    }, false, { ready: () => !presentationState.bodyFxScrollActive }).catch((error) => fail('chat listener', error));
  }

  function armCatchUpWatchdog() {
    if (hostState.unloading) return;
    workQueue.clearTimer('catchUpTimer');
    const interval = hostState.hooks.listener === true ? 45000 : 4500;
    workQueue.schedule(
      'catchUpTimer',
      () => {
        return catchUpLatestOutput().catch((error) => fail('latest output catch-up', error));
      },
      interval,
      true
    );
  }

  const beforeRequest = async (messages, type) => {
    // Translation is a view of the original response, not a new world-state
    // request. Removing its card markers here makes them impossible to retain.
    if (/translate/i.test(String(type || ''))) return messages || [];
    const safeMessages = (messages || []).map((message) => ({
      ...message,
      content: processTransportStripper(message.content)
    }));
    if (!mainRequestType(type)) return safeMessages;
    try {
      const loaded = await cachedRequestState();
      if (!loaded || !(await isEnabled(loaded.character))) return safeMessages;
      const settings = await outputSettings(loaded.character);
      settingsState.debugEnabled = settings.debugEnabled;
      if (!settings.mainOutput) return safeMessages;
      if (!settings.itemsEnabled && !settings.skillsEnabled && !settings.encountersEnabled) return safeMessages;
      const recent = safeMessages
        .slice(-4)
        .map((message) => message.content || '')
        .join('\n');
      const domains = enabledCodexDomains(settings);
      const moduleAssets = settings.encountersEnabled
        ? await modulePortraitAssets(settings, loaded.character, loaded.chat)
        : [];
      const instruction = `${protocolForSettings(settings, loaded.character, moduleAssets, { narrative: recent, entities: encounterEntities(loaded.codexSnapshot) })}${settings.itemsEnabled ? `\n\n${ITEMXCore.anchor(ITEMXHistory.requestSnapshot(loaded, recent))}` : ''}${domains.length ? `\n\n${ITEMXCodex.anchor(loaded.codexSnapshot, recent, 9000, { enabledDomains: domains })}` : ''}`;
      debugRecord('beforeRequest', {
        items: settings.itemsEnabled,
        skills: settings.skillsEnabled,
        encounters: settings.encountersEnabled,
        messages: safeMessages.length
      });
      return injectRequestProtocol(safeMessages, instruction);
    } catch (error) {
      fail('beforeRequest', error);
      return safeMessages;
    }
  };

  const processHandler = async (content) => processTransportStripper(content);

  async function processOutput(content, type) {
    if (!mainRequestType(type)) return content;
    content = ITEMXCore.stripInventoryEcho(content);
    try {
      const ctx = await context();
      if (!ctx) return content;
      const enabled = await isEnabled(ctx.character);
      const settings = await outputSettings(ctx.character);
      settingsState.debugEnabled = settings.debugEnabled;
      if (!enabled || !settings.mainOutput) return stripAllTransport(content);
      const lookup = buildMessageEventLookup(ctx.chat);
      const base = rebuildWithManual(ctx.chat, lookup).registry;
      const result = settings.itemsEnabled
        ? ITEMXCore.extractResponse(content, base)
        : { content: stripItemTransport(content), events: [], errors: [] };
      const codexResult = ITEMXCodex.extractResponse(
        result.content,
        rebuildCodexWithLedger(ctx.chat, lookup, { rarityMode: settings.rarityMode }),
        { enabledDomains: enabledCodexDomains(settings), rarityMode: settings.rarityMode, skillEvidenceText: content }
      );
      const reviewed = codexResult.content.replace(/<!--(ITEMX2|CODEX2):([A-Za-z0-9_-]+)-->/g, (raw, prefix, code) => {
        const core = prefix === 'ITEMX2' ? ITEMXCore : ITEMXCodex;
        const payload = core.decodePayload(code);
        return payload?.event
          ? core.marker({ ...payload, review: payload.review || { source: 'main', checked: false } })
          : raw;
      });
      prepareInlinePortraits(ctx, codexResult.snapshot, settings);
      const positioned = positionMarkersByNarrative(reviewed);
      armEventBursts(positioned);
      if (
        result.events.length ||
        result.errors.length ||
        codexResult.events.length ||
        codexResult.errors.length ||
        codexResult.content !== content
      ) {
        pipelineState.latestMarkers = markerCodes(positioned);
        workQueue.remember('uncommitted-markers', new Set(pipelineState.latestMarkers));
        const errors = result.errors.length + codexResult.errors.length,
          events = result.events.length + codexResult.events.length;
        uiState.status = errors ? ITEMXText("pipeline.008", errors) : ITEMXText("pipeline.007", events);
        pipelineState.generation += 1;
        debugRecord('processOutput', {
          itemEvents: result.events.length,
          codexEvents: codexResult.events.length,
          errors
        });
      }
      return positioned;
    } catch (error) {
      fail('processOutput', error);
      return stripAllTransport(content);
    }
  }

  const afterRequest = async (content, type) => processOutput(content, type);

  const outputFallback = async (content) => {
    const processed = await processOutput(content, 'main');
    if (hostState.hooks.listener === 'unsupported' && auxState.auxActive === 0)
      scheduleLegacyCommitRecovery();
    return processed;
  };

  async function installPipelineHooks(options = {}) {
    return installPipelineHooksNow(options);
  }

  async function installDisplayHooks() {
    if (!hostState.hooks.process) {
      await Risuai.addRisuScriptHandler('process', pipelineEntries.process);
      hostState.hooks.process = true;
    }
    if (!hostState.hooks.output) {
      await Risuai.addRisuScriptHandler('output', pipelineEntries.output);
      hostState.hooks.output = true;
    }
    if (!hostState.hooks.display) {
      await Risuai.addRisuScriptHandler('display', pipelineEntries.display);
      hostState.hooks.display = true;
    }
  }

  async function refreshPipelineBindingsAfterResume() {
    // Host-side hook sets can be rebuilt independently of a still-alive plugin
    // iframe. Re-adding the same callback is idempotent because RisuAI stores
    // handlers in Sets and the v3 bridge preserves callback identity.
    await Risuai.addRisuScriptHandler('process', pipelineEntries.process);
    await Risuai.addRisuScriptHandler('output', pipelineEntries.output);
    await Risuai.addRisuScriptHandler('display', pipelineEntries.display);
    if (hostState.permissions.replacer) {
      await Risuai.addRisuReplacer('beforeRequest', pipelineEntries.before);
      await Risuai.addRisuReplacer('afterRequest', pipelineEntries.after);
    }
  }

  async function installPipelineHooksNow({ prompt = false } = {}) {
    try {
      await installDisplayHooks();
      const permission =
        typeof Risuai.requestPluginPermission === 'function' ? await Risuai.requestPluginPermission('replacer') : true;
      hostState.permissions.replacer = permission === true;
      if (!hostState.permissions.replacer) {
        if (hostState.hooks.before) {
          try {
            await Risuai.removeRisuReplacer('beforeRequest', pipelineEntries.before);
          } catch {}
        }
        if (hostState.hooks.after) {
          try {
            await Risuai.removeRisuReplacer('afterRequest', pipelineEntries.after);
          } catch {}
        }
        hostState.hooks.before = false;
        hostState.hooks.after = false;
        hostState.lastHookError = ITEMXText("pipeline.006");
        uiState.status = ITEMXText("pipeline.005");
      } else {
        if (!hostState.hooks.before) {
          await Risuai.addRisuReplacer('beforeRequest', pipelineEntries.before);
          hostState.hooks.before = true;
        }
        if (!hostState.hooks.after) {
          await Risuai.addRisuReplacer('afterRequest', pipelineEntries.after);
          hostState.hooks.after = true;
        }
      }
      if (!hostState.hooks.listener) {
        if (typeof Risuai.addRisuChatListener !== 'function') {
          hostState.hooks.listener = 'unsupported';
          log('chat listener unavailable; continuing with core request/output hooks');
        } else
          try {
            await Risuai.addRisuChatListener('output', (output) => {
              const loaded = pipelineState.cachedLoaded;
              if (
                output?.chat &&
                loaded?.key === pipelineState.activeContextKey &&
                output.characterIndex === loaded.characterIndex &&
                output.chatIndex === loaded.chatIndex
              )
                commitEventBursts(output.chat);
              void scheduleCommittedOutputSync();
            });
            hostState.hooks.listener = true;
          } catch (error) {
            const message = String(error?.message || error || '');
            if (!/API method addRisuChatListener not found/i.test(message)) throw error;
            hostState.hooks.listener = 'unsupported';
            log('chat listener unavailable; continuing with core request/output hooks');
          }
      }
      if (hostState.permissions.replacer) {
        hostState.lastHookError = '';
        uiState.status = prompt ? ITEMXText("pipeline.004") : ITEMXText("pipeline.003");
      }
      if (workQueue.hasTimer('catchUpTimer')) armCatchUpWatchdog();
      return hostState.permissions.replacer;
    } catch (error) {
      hostState.permissions.replacer = false;
      hostState.lastHookError = String(error?.message || error || ITEMXText("pipeline.002"));
      uiState.status = ITEMXText("pipeline.001");
      fail('pipeline hooks', error);
      return false;
    }
  }

  function armRemountWatchdog() {
    if (hostState.unloading) return;
    const interval = hostState.hostObserver || !pipelineState.activeContextKey ? 10000 : 1200;
    workQueue.clearTimer('remountTimer');

    workQueue.schedule(
      'remountTimer',
      () => {
        if (!presentationState.bodyFxScrollActive) {
          const now = Date.now();
          if (!pipelineState.activeContextKey) {
            return ensureRootInventory();
          } else if (!hostState.hostObserver || workQueue.age('remount') >= 10000) {
            return ensureRootInventory();
          }
        }
      },
      interval,
      true
    );
  }

  async function recoverAfterBrowserResume() {
    if (hostState.unloading) return;
    workQueue.cancel(intent => intent.kind === 'committed-output', false);
    const pending = (async () => {
      clearScrollTimers();
      presentationState.bodyFxScrollActive = false;
      presentationState.bodyFxSawScroll = false;


      if (presentationState.bodyFxClassOwner)
        await presentationState.bodyFxClassOwner.removeClass('x-risu-itemx-body-scrolling').catch(() => {});

      await refreshPipelineBindingsAfterResume();
      pipelineState.cachedLoaded = null;
      pipelineState.generation += 1;
      await installMainStyle();
      // Resume restores rendering and bindings only. Auxiliary regeneration and
      // committed-output sync rewrite the stored message, and the catch-up guard
      // hashes that same message, so every foreground return re-injected planning
      // blocks once per resume. Regeneration belongs to real new turns.
      await rebuildCurrent({ upgradeDisplayRefs: true });
      await ensureRootInventory();
      hostState.backgrounded = false;
    })().catch((error) => fail('browser resume recovery', error));
    return pending;
  }

  function queueBrowserResume() {
    if (hostState.unloading || !hostState.backgrounded) return;
    workQueue.clearTimer('resumeTimer');
    workQueue.schedule(
      'resumeTimer',
      () => {
        return recoverAfterBrowserResume();
      },
      80,
      false
    );
  }

  function installBrowserResumeHandlers() {
    const bind = (target, type, handler) => {
      if (!target || typeof target.addEventListener !== 'function') return;
      target.addEventListener(type, handler);
      hostState.resumeBindings.push({ target, type, handler });
    };
    const background = () => {
      hostState.backgrounded = true;
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
