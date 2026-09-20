/* ITEMX aux owner. Concatenated inside the runtime closure. */
  function modelText(result) {
    if (typeof result === 'string') return result;
    if (typeof result?.result === 'string') return result.result;
    if (typeof result?.content === 'string') return result.content;
    if (typeof result?.text === 'string') return result.text;
    return '';
  }

  function auxiliaryProviderError(value) {
    const text = value instanceof Error ? String(value.message || value) : modelText(value);
    if (
      !/(?:Unknown Plugin detected\. Please change the model or enable the corresponding plugin\.|Plugin calls are blocked by the caller\.)/i.test(
        text
      )
    )
      return null;
    const error = new Error(
      ITEMXText("aux.059")
    );
    error.code = 'AUX_PROVIDER_UNAVAILABLE';
    return error;
  }

  function auxStatusText() {
    if (auxState.auxActive > 0) return auxWorkingLabel() || ITEMXText("aux.058");
    const last = auxState.auxLast;
    if (!last?.at) return ITEMXText("aux.057");
    const time = new Date(last.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${last.label} · ${time}`;
  }

  function connectionSummary() {
    const hook =
      hostState.permissions.replacer === true
        ? [ITEMXText("aux.056"), 'on']
        : hostState.permissions.replacer === false
          ? [ITEMXText("aux.055"), 'off']
          : [ITEMXText("aux.054"), 'warn'];
    const dom =
      hostState.permissions.mainDom === true
        ? [ITEMXText("aux.053"), 'on']
        : hostState.permissions.mainDom === false
          ? [ITEMXText("aux.052"), 'off']
          : [ITEMXText("aux.051"), 'warn'];
    const listener =
      hostState.hooks.listener === 'unsupported'
        ? [ITEMXText("aux.050"), 'warn']
        : hostState.hooks.listener
          ? [ITEMXText("aux.049"), 'on']
          : [ITEMXText("aux.048"), 'warn'];
    return {
      hook,
      dom,
      listener,
      ready: hostState.permissions.replacer === true && hostState.permissions.mainDom === true
    };
  }

  async function updateConnectionUi() {
    if (!hostState.mainDoc) return;
    const connection = connectionSummary();
    const chips = [
      ['hook', connection.hook],
      ['dom', connection.dom],
      ['listener', connection.listener]
    ];
    for (const [key, [label, tone]] of chips) {
      const chip = await hostState.mainDoc.querySelector(`.x-risu-itemx2-connection-${key}`);
      if (!chip) continue;
      await chip.setTextContent(label);
      await chip.removeClass('x-risu-itemx2-status-chip-on');
      await chip.removeClass('x-risu-itemx2-status-chip-warn');
      await chip.removeClass('x-risu-itemx2-status-chip-off');
      await chip.addClass(`x-risu-itemx2-status-chip-${tone}`);
    }
    const button = await hostState.mainDoc.querySelector('.x-risu-itemx2-setting-connect');
    if (!button) return;
    await button.setTextContent(workQueue.isActive('connect') ? ITEMXText("aux.047") : connection.ready ? ITEMXText("aux.046") : ITEMXText("aux.045"));
    if (workQueue.isActive('connect')) await button.addClass('x-risu-itemx2-root-setting-button-busy');
    else await button.removeClass('x-risu-itemx2-root-setting-button-busy');
  }

  // A switch draws its knob with a child <i>, so setTextContent would delete it:
  // the control turns into a bare pill that shows nothing while on, because the
  // on state paints text transparent. Patch the state only and leave the knob.
  async function updateRootSwitch(selector, on, onClass = 'x-risu-itemx2-setting-on') {
    const control = await findRootControl(selector);
    if (!control) return repaintRootFallback();
    if (on) await control.addClass(onClass);
    else await control.removeClass(onClass);
    if (uiState.panelOpen) await control.setAttribute('aria-checked', on ? 'true' : 'false');
    else await updateHostSwitchAria(control, selector, on);
    return true;
  }

  async function updateHostSwitchAria(control, selector, on) {
    // Stock SafeElement rejects non-x- attributes. Its sanitized HTML setter is
    // the supported way to update ARIA. Replace only this button, retaining its
    // contents; clicks are delegated on the drawer, not bound to the button.
    const html = await control.getOuterHTML();
    const next = html.replace(/^(<button\b[^>]*\baria-checked=")(true|false)(")/, `$1${on ? 'true' : 'false'}$3`);
    if (next === html) return;
    const focused = await findRootControl(`${selector}:focus`);
    await control.setOuterHTML(next);
    if (focused) {
      const replacement = await findRootControl(selector);
      if (replacement) await replacement.focus();
    }
  }

  // 도메인 카드는 스위치가 아니다. 자식 <i> 가 노브가 아니라 상태 글자라서
  // 여기서만 글자를 갱신한다. 이 둘을 한 함수로 합치면 언젠가 노브를 지운다.
  async function updateRootDomainCard(selector, on, label) {
    const card = await findRootControl(selector);
    if (!card) return repaintRootFallback();
    if (on) await card.addClass('x-risu-itemx2-setting-on');
    else await card.removeClass('x-risu-itemx2-setting-on');
    const state = await card.querySelector('i');
    if (state) await state.setTextContent(label);
    return true;
  }

  async function findRootControl(selector) {
    // Use the same surface as click hit-testing. A hidden host drawer can still
    // match while the iframe panel is open; searching it first patches a copy.
    const doc = panelDocument();
    if (!doc) return null;
    const bare = selector.replace('.x-risu-', '.');
    for (const query of [selector, bare]) {
      try {
        const found = await doc.querySelector(query);
        if (found) return found;
      } catch {}
    }
    return null;
  }

  // 제자리 패치가 실패해도 화면이 옛 상태로 남지 않게 하는 단 하나의 대비.
  // 호출부에 흩어 두면 토글이 늘 때마다 같은 코드를 또 쓰게 된다.
  async function repaintRootFallback() {
    if (!uiState.rootOpen) return false;
    await openRootInventory({ open: true, tab: uiState.activeRootTab });
    return true;
  }

  async function updateRootSettingButton(selector, label, enabled = null) {
    const button = await findRootControl(selector);
    if (!button) return;
    await button.setTextContent(label);
    if (enabled === true) await button.addClass('x-risu-itemx2-setting-on');
    else if (enabled === false) await button.removeClass('x-risu-itemx2-setting-on');
  }

  async function applyRootSetting(change) {
    return change();
  }

  const auxWorkingLabel = () => auxState.auxLast.state === 'idle' ? ITEMXText("aux.044") : auxState.auxLast.label;

  async function setAuxOutcome(state, label, events = null) {
    auxState.auxLast = { state, label, events, at: Date.now() };
    await syncAuxIndicator();
    workQueue.clearTimer('auxToastTimer');
    workQueue.schedule(
      'auxToastTimer',
      () => {
        void syncAuxIndicator();
      },
      2600,
      false
    );
  }

  async function syncAuxIndicator() {
    try {
      if (!hostState.mainDoc) return;
      const indicator = await hostState.mainDoc.querySelector('.x-risu-itemx2-aux-status');
      if (!indicator) return;
      const label = await indicator.querySelector('.x-risu-itemx2-aux-status-label');
      if (label) await label.setTextContent(auxState.auxActive > 0 ? auxWorkingLabel() : auxState.auxLast.label);
      const settingLabel = await hostState.mainDoc.querySelector('.x-risu-itemx2-aux-setting-status');
      if (settingLabel) await settingLabel.setTextContent(auxStatusText());
      const runButton = await hostState.mainDoc.querySelector('.x-risu-itemx2-setting-aux-run');
      if (runButton) {
        await runButton.setTextContent(auxState.auxActive > 0 ? ITEMXText("aux.043") : ITEMXText("aux.042"));
        if (auxState.auxActive > 0) await runButton.addClass('x-risu-itemx2-root-setting-button-busy');
        else await runButton.removeClass('x-risu-itemx2-root-setting-button-busy');
      }
      const recent = auxState.auxLast.at && Date.now() - auxState.auxLast.at < 2600;
      if (auxState.auxActive > 0 || recent) await indicator.addClass('x-risu-itemx2-aux-status-on');
      else await indicator.removeClass('x-risu-itemx2-aux-status-on');
      if (auxState.auxLast.state === 'done' && auxState.auxActive === 0)
        await indicator.addClass('x-risu-itemx2-aux-status-done');
      else await indicator.removeClass('x-risu-itemx2-aux-status-done');
      if (auxState.auxLast.state === 'failed' && auxState.auxActive === 0)
        await indicator.addClass('x-risu-itemx2-aux-status-failed');
      else await indicator.removeClass('x-risu-itemx2-aux-status-failed');
    } catch (error) {
      fail('aux indicator', error);
    }
  }

  async function runAuxModel(prompt, label = ITEMXText("aux.041")) {
    if (typeof Risuai.runLLMModel !== 'function') throw new Error(ITEMXText("aux.040"));
    auxState.auxActive += 1;
    auxState.auxLast = { state: 'running', label, at: Date.now(), events: null };
    uiState.status = label;
    await syncAuxIndicator();
    try {
      const result = await workQueue.external(() =>
        withTimeout(
          Risuai.runLLMModel({ messages: [{ role: 'user', content: prompt }], mode: 'otherAx', allowPlugins: true }),
          90000,
          ITEMXText("aux.039")
        )
      );
      const providerError = auxiliaryProviderError(result);
      if (providerError) throw providerError;
      workQueue.forget('aux-provider');

      auxState.auxLast = { state: 'done', label: ITEMXText("aux.038"), at: Date.now(), events: null };
      return result;
    } catch (error) {
      const providerError = auxiliaryProviderError(error) || error;
      if (providerError?.code === 'AUX_PROVIDER_UNAVAILABLE') {
        workQueue.remember('aux-provider', 'unavailable');
      }
      auxState.auxLast = { state: 'failed', label: ITEMXText("aux.037"), at: Date.now(), events: null };
      throw providerError;
    } finally {
      auxState.auxActive = Math.max(0, auxState.auxActive - 1);
      await syncAuxIndicator();
      if (auxState.auxActive === 0)
        await setAuxOutcome(auxState.auxLast.state, auxState.auxLast.label, auxState.auxLast.events);
    }
  }

  function auxiliaryHistory(chat) {
    try {
      const raw = chat?.scriptstate?.[ITEMX_AUX_KEY];
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  async function auxiliaryZeroHistory(ctx) {
    return ITEMXStorage.cache(ctx.chat).auxZero || {};
  }

  async function rememberAuxiliaryZero(ctx, guardKey) {
    const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
    if (!latest || JSON.stringify(latest.message) !== JSON.stringify(ctx.chat.message)) return;
    const derived = ITEMXStorage.cache(latest);
    derived.auxZero = boundedObjectTail({ ...derived.auxZero, [guardKey]: Date.now() }, 64, ITEMX_AUX_HISTORY_MAX_BYTES);
    latest.scriptstate = { ...latest.scriptstate, [ITEMXStorage.CACHE]: JSON.stringify({ ...derived, v: 1 }) };
    await saveChat(ctx.characterIndex, ctx.chatIndex, latest);
  }

  function messageMetadata(message) {
    if (message?.metadata && typeof message.metadata === 'object') return message.metadata;
    try {
      return typeof message?.metadata === 'string' ? JSON.parse(message.metadata) : {};
    } catch {
      return {};
    }
  }

  function incompleteCommittedOutput(source) {
    const text = String(source || '').trim();
    if (!text) return true;
    if ((text.match(/```/g) || []).length % 2 === 1) return true;
    for (const tag of ['thoughts', 'analysis']) {
      const opens = (text.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length;
      const closes = (text.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
      if (opens > closes) return true;
    }
    return /<[^>]*$/.test(text);
  }

  function automaticAuxReady(chat, index, source) {
    const message = chat?.message?.[index];
    const metadata = messageMetadata(message);
    return (
      !chat?.isStreaming && !message?.isStreaming && metadata.bgContinue !== true && !incompleteCommittedOutput(source)
    );
  }

  function automaticAuxSettled(ctx, index, source) {
    const fingerprint = `${ctx.key}:${index}:${ITEMXCore.fnv1a(source)}`;
    return workQueue.settled('aux-settle', fingerprint, ITEMX_AUX_SETTLE_MS);
  }

  function stateItemEvidence(chat) {
    const rows = [];
    const keyPattern =
      /(weapon|armor|item|inventory|equipment|outfit|accessor|gear|belonging|무기|방어구|아이템|장비|의상|소지품)/i;
    for (const [key, raw] of Object.entries(chat?.scriptstate || {})) {
      // ITEMX must not feed either its own derived state or stale
      // legacy ITEMX module state back to the model as world evidence.
      if (/itemx/i.test(key) || !keyPattern.test(key)) continue;
      const value = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw);
      if (!value || /^(?:none|null|undefined|없음|무|0|\[\]|\{\})$/i.test(value)) continue;
      rows.push(`${key} = ${value.slice(0, 500)}`);
      if (rows.length >= 24 || rows.join('\n').length >= 4000) break;
    }
    return rows.length ? rows.join('\n').slice(0, 4000) : '(no item-like state variables)';
  }

  const LIGHTBOARD_DATA_RE =
    /(?:^|\n)[ \t]*---[ \t]*\r?\n[ \t]*\[LBDATA START\][\s\S]*?\[LBDATA END\][ \t]*\r?\n[ \t]*---[ \t]*(?=\r?\n|$)/gi;

  function stripAuxiliaryDataBlocks(value) {
    return String(value || '').replace(LIGHTBOARD_DATA_RE, '\n');
  }

  function auxiliaryVisibleText(value, { itemRefs = true } = {}) {
    let text = stripAuxiliaryDataBlocks(value);
    text = text.replace(/<(thoughts|analysis)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    text = itemRefs
      ? ITEMXCodex.requestView(ITEMXCore.requestView(text))
      : text.replace(ITEMXCore.MARKER_RE, '').replace(ITEMXCodex.MARKER_RE, '');
    text = text.replace(ITEMX_REF_RE, '').replace(ITEMX_CODEX_REF_RE, '');
    return text.replace(/\n{3,}/g, '\n\n').trim();
  }

  function clipAuxiliaryText(value, max) {
    const text = String(value || '').trim();
    if (text.length <= max) return text;
    const head = Math.floor(max * 0.42),
      tail = max - head;
    return `${text.slice(0, head)}\n…[middle omitted for bounded auxiliary context]…\n${text.slice(-tail)}`;
  }

  function auxiliaryConversationContext(chat, targetIndex) {
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    let userIndex = -1;
    for (let index = targetIndex - 1; index >= 0; index -= 1) {
      if (/^(?:user|human)$/i.test(String(messages[index]?.role || messages[index]?.type || ''))) {
        userIndex = index;
        break;
      }
    }
    const triggeringUser =
      userIndex >= 0
        ? clipAuxiliaryText(auxiliaryVisibleText(messageData(messages[userIndex])), 3000)
        : '(triggering user turn unavailable)';
    const rows = [];
    let consumed = 0;
    const historyEnd = userIndex >= 0 ? userIndex : targetIndex;
    for (let index = historyEnd - 1; index >= 0 && rows.length < 6 && consumed < 9000; index -= 1) {
      const message = messages[index];
      const visible = clipAuxiliaryText(auxiliaryVisibleText(messageData(message)), 3600);
      if (!visible) continue;
      const role = /^(?:user|human)$/i.test(String(message?.role || message?.type || '')) ? 'USER' : 'ASSISTANT';
      const row = `[message ${index} · ${role}]\n${visible}`;
      if (consumed + row.length > 9000) {
        const remaining = 9000 - consumed;
        if (remaining >= 500) rows.unshift(clipAuxiliaryText(row, remaining));
        break;
      }
      rows.unshift(row);
      consumed += row.length;
    }
    return { triggeringUser, recent: rows.join('\n\n') || '(no earlier narrative context)' };
  }

  function assistantMessageIndex(chat, preferred = null) {
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    if (Number.isInteger(preferred) && preferred >= 0 && preferred < messages.length) return preferred;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (!messageData(message).trim()) continue;
      if (/^(?:user|human)$/i.test(String(message?.role || message?.type || ''))) continue;
      return index;
    }
    return -1;
  }

  async function recoverAuxiliaryOutput(options = {}) {
    return recoverAuxiliaryOutputNow(options);
  }

  function stableEventValue(value) {
    if (Array.isArray(value)) return value.map(stableEventValue);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, stableEventValue(value[key])])
      );
    return value;
  }

  function eventValueKey(value) {
    return JSON.stringify(stableEventValue(value));
  }

  function auxiliaryEventReconciler(domain, initial, represented, narrative) {
    const names = new Map(),
      aliases = new Map();
    const normalize = (value) =>
      String(value || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\s+/g, '');
    const entries = (state) => (domain === 'item' ? state.items : state.monsters.entries);
    const index = (entity) => {
      const name = normalize(entity?.name);
      if (!name) return;
      if (!names.has(name)) names.set(name, new Set());
      names.get(name).add(entity.id);
    };
    Object.values(entries(initial)).forEach(index);
    const repeatedActions = new Set(represented.filter((event) => event.kind === 'patch').map(eventValueKey));
    const lastBatchAction = new Map();
    const known = (value) => value != null && !/^(?:|none|unknown|미상|미분류)$/i.test(String(value).trim());
    const separateMention = (name) => {
      const text = String(narrative || '').normalize('NFKC');
      const at = text.indexOf(name);
      if (at < 0) return false;
      return /또\s*다른|별개|두\s*번째|세\s*번째|한\s*(?:자루|개|마리)\s*더|\b(?:another|different|second|third)\b/i.test(
        text.slice(Math.max(0, at - 65), at + name.length + 65)
      );
    };
    return (source, state) => {
      const event = ITEMXCore.clone(source),
        registry = entries(state);
      if (event.kind === 'exam') {
        const entity = domain === 'item' ? event.item : event.entity;
        if (!registry[entity.id] && !separateMention(entity.name)) {
          const provided = new Set(entity._provided || []);
          const keys =
            domain === 'item'
              ? [
                  ['itemType', 'type'],
                  ['rarity', 'internalrarity'],
                  ['affinity', 'affinity'],
                  ['affinity2', 'affinity2'],
                  ['power', 'power'],
                  ['durability', 'durability'],
                  ['condition', 'condition'],
                  ['possession', 'possession'],
                  ['location', 'location']
                ]
              : [
                  ['kind', 'type'],
                  ['portrait', 'portrait']
                ];
          const candidates = [...(names.get(normalize(entity.name)) || [])]
            .map((id) => registry[id])
            .filter(
              (prior) =>
                prior &&
                normalize(prior.name) === normalize(entity.name) &&
                keys.every(
                  ([key, raw]) =>
                    !provided.has(raw) ||
                    !known(entity[key]) ||
                    !known(prior[key]) ||
                    normalize(entity[key]) === normalize(prior[key])
                )
            );
          if (candidates.length === 1) {
            aliases.set(entity.id, candidates[0].id);
            entity.id = candidates[0].id;
            entity.name = candidates[0].name;
          } else if (candidates.length > 1) {
            // Preserve ambiguous old records; do not create yet another guessed identity.
            return null;
          }
        }
        index(entity);
      } else {
        const patch = event.patch;
        for (const key of ['id', 'equip', 'unequip'])
          if (aliases.has(patch[key]) && !registry[patch[key]]) patch[key] = aliases.get(patch[key]);
        for (const key of ['inputs', 'outputs'])
          for (const row of patch[key] || [])
            if (aliases.has(row.id) && !registry[row.id]) row.id = aliases.get(row.id);
        const signature = eventValueKey(event);
        const target = patch.id || eventValueKey([patch.equip, patch.unequip, patch.inputs, patch.outputs]);
        if (repeatedActions.has(signature) || lastBatchAction.get(target) === signature) return null;
        // Preserve real equip -> unequip -> equip (and analogous state cycles).
        lastBatchAction.set(target, signature);
      }
      return event;
    };
  }

  function itemEventState(reg, event) {
    const patch = event.patch || {};
    const ids = [
      event.item?.id,
      patch.id,
      patch.equip,
      patch.unequip,
      ...(patch.inputs || []).map((x) => x.id),
      ...(patch.outputs || []).map((x) => x.id)
    ].filter(Boolean);
    return eventValueKey(ids.map((id) => reg.items[id] || null));
  }

  async function recoverAuxiliaryOutputNow({ messageIndex = null, force = false } = {}) {
    const ctx = await context();
    if (!ctx || !(await isEnabled(ctx.character))) return null;
    // Re-check against this chat rather than the cached flag: recovery commits
    // straight to the chat and must never land on an unreadable ledger.
    if (assertLogReadable(ctx.chat)) return null;
    const settings = await outputSettings(ctx.character);
    settingsState.debugEnabled = settings.debugEnabled;
    if (!settings.itemsEnabled && !settings.skillsEnabled && !settings.encountersEnabled) return [];
    if (settings.auxOutput === 'off' && !force) return [];
    if ((workQueue.revision('aux-provider') === 'unavailable') && !force) return [];
    const index = assistantMessageIndex(ctx.chat, messageIndex);
    if (index < 0) return null;
    const restored = checkpointStatus(ctx.chat);
    if (!force && restored.valid && restored.checkpoint.restored && index <= restored.checkpoint.boundary) return [];
    const source = messageData(ctx.chat.message[index]);
    if (!force && !automaticAuxReady(ctx.chat, index, source)) return null;
    const sourceHash = ITEMXCore.fnv1a(source);
    // Anchor the recovery ledger on the stable message id. A body-derived key is
    // invalidated by the very commit this function performs, so every reopen wrote
    // a fresh key and recovery ran again on an already-recovered message.
    const auxMessageId = ctx.chat.message?.[index]?.chatId || `idx-${index}`;
    const guardKey = `${index}:msg-${auxMessageId}:${settings.auxOutput}:${Number(settings.itemsEnabled)}${Number(settings.skillsEnabled)}${Number(settings.encountersEnabled)}:q${ITEMXQuality.REVISION}:p${ITEMX_AUX_PROMPT_REVISION}`;
    if (auxiliaryHistory(ctx.chat)[guardKey] && !force) return [];
    if ((await auxiliaryZeroHistory(ctx))[guardKey] && !force) return [];
    if (typeof Risuai.runLLMModel !== 'function') return null;

    return (async () => {
      if (!force) await delay(350);
      const current = await readChat(ctx.characterIndex, ctx.chatIndex);
      if (!current || ITEMXCore.fnv1a(messageData(current.message?.[index])) !== sourceHash) return null;
      if (!force && !automaticAuxReady(current, index, messageData(current.message[index]))) return null;
      if (auxiliaryHistory(current)[guardKey] && !force) return null;
      const lookup = buildMessageEventLookup(current);
      const snapshot = rebuildWithManual(current, lookup);
      const codexSnapshot = rebuildCodexWithLedger(current, lookup, { rarityMode: settings.rarityMode });
      const committedNarrative = clipAuxiliaryText(
        auxiliaryVisibleText(messageData(current.message[index]), { itemRefs: false }),
        14000
      );
      if (!committedNarrative && !force) return null;
      const conversation = auxiliaryConversationContext(current, index);
      const domains = enabledCodexDomains(settings);
      const requested = [
        settings.itemsEnabled && 'items',
        settings.skillsEnabled && 'skills',
        settings.encountersEnabled && 'encounters'
      ]
        .filter(Boolean)
        .join(', ');
      const moduleAssets = settings.encountersEnabled
        ? await modulePortraitAssets(settings, ctx.character, current)
        : [];
      const protocolOptions = {
        narrative: [conversation.triggeringUser, conversation.recent, committedNarrative].filter(Boolean).join('\n'),
        entities: encounterEntities(codexSnapshot)
      };
      const itemRecoveryRules = settings.itemsEnabled
        ? `Recover every settled item acquisition, creation, equipment, damage, loss, destruction or material appraisal omitted by the main output, even when the main output already emitted some other ITEMX events. Reuse existing ids from CURRENT INVENTORY. For a genuinely new item, emit a complete itemExam with coherent identity, rarity, visual theme, affinity only when established, and concrete effects supported by context. If the triggering turn and committed output conclusively correct an existing item's name or descriptive identity, including an earlier misspelling, emit itemPatch op=merge for that existing id with only the corrected descriptive fields; never re-emit a complete itemExam merely to correct an existing item. CURRENT INVENTORY is authoritative for continuity, not for a contradicted typo.`
        : '';
      const codexRecoveryRules = domains.length
        ? `Recover settled changes only for enabled CODEX domains, plus first discovery of an already-owned persistent player skill absent from CURRENT ACTIVE SKILLS. Skills include owned, usable character-bound powers, command authorities, supernatural marks, contract rights, transformations and summoning faculties. Finite or rechargeable charges belong in cost/state; they do not make the enduring capability transient, and individual charges are not items or skills. One-use consumables remain items; decorative marks or lore facts without usable effects stay excluded. Emit one skillExam for a confirmed missing capability and reuse existing ids. A bracketed word or generic action alone is not proof. Keep NPC or opponent techniques only in encounter moves unless the player acquires them. Track later learning, mastery, equipment, sealing or loss. For encounters, track actual hostility, combat or accepted sparring; never register mere mentions, rumors, passive NPCs or unaccepted challenges.`
        : '';
      const prompt = `${protocolForSettings(settings, ctx.character, moduleAssets, protocolOptions)}\n\nYou are the ITEMX context-aware auxiliary regeneration pass. Enabled domains: ${requested}. Read the triggering user turn, recent narrative continuity, committed assistant output, authoritative registries, and non-ITEMX state evidence together. Output transport for enabled domains only, with no prose or code fence. Recover every settled change omitted by the main output. ${itemRecoveryRules} ${codexRecoveryRules} Multiple events must be emitted as separate blocks in narrative order. The committed assistant output decides what actually happened; earlier context resolves identity, continuity, ownership, prior damage and user intent. Do not merely catch or copy nouns, do not invent plausible events, do not repeat events already represented in the authoritative registries, and output exactly NONE when nothing is missing.\n\n${settings.itemsEnabled ? `CURRENT INVENTORY:\n${ITEMXCore.anchor(snapshot)}` : 'ITEM DOMAIN DISABLED'}\n\n${domains.length ? `CURRENT ACTIVE SKILLS AND ENCOUNTERS:\n${ITEMXCodex.anchor(codexSnapshot, committedNarrative, 9000, { enabledDomains: domains })}` : 'CODEX DOMAINS DISABLED'}\n\nTRIGGERING USER TURN:\n${conversation.triggeringUser}\n\nRECENT NARRATIVE CONTEXT (oldest to newest):\n${conversation.recent}\n\nCOMMITTED ASSISTANT OUTPUT (visible narrative only):\n${committedNarrative}\n\nNON-ITEMX STATE EVIDENCE:\n${stateItemEvidence(current)}`;
      uiState.status = ITEMXText("aux.036");
      const response = await runAuxModel(prompt, ITEMXText("aux.035"));
      const raw = modelText(response);
      if (!raw) throw new Error(ITEMXText("aux.034"));
      const itemReconciler = auxiliaryEventReconciler(
        'item',
        snapshot.registry,
        messageEvents(source, 'item', lookup),
        committedNarrative
      );
      const monsterReconciler = auxiliaryEventReconciler(
        'monster',
        codexSnapshot,
        messageEvents(source, 'codex', lookup).filter((event) => event.domain === 'monster'),
        committedNarrative
      );
      const parsed = settings.itemsEnabled
        ? ITEMXCore.extractResponse(raw, snapshot.registry, { prepareEvent: itemReconciler })
        : { content: stripItemTransport(raw), events: [], errors: [] };
      const validationRegistry = ITEMXCore.clone(snapshot.registry);
      const validItems = [],
        partials = [],
        rejectedIds = [];
      const checkedIds = new Set();
      const acceptItemEvent = (event) => {
        const before = itemEventState(validationRegistry, event);
        if (ITEMXCore.applyEvent(validationRegistry, event) == null) return false;
        if (before !== itemEventState(validationRegistry, event)) validItems.push(event);
        return true;
      };
      const itemSiblings = parsed.events.filter((event) => event.kind === 'exam').map((event) => event.item);
      const itemEvidenceContext = [conversation.triggeringUser, conversation.recent, committedNarrative]
        .filter(Boolean)
        .join('\n\n');
      for (const event of parsed.events) {
        if (event.kind !== 'exam') {
          acceptItemEvent(event);
          continue;
        }
        let evidence = ITEMXQuality.detectItemEvidence(committedNarrative, event.item, itemSiblings);
        if (!evidence.segment)
          evidence = ITEMXQuality.detectItemEvidence(itemEvidenceContext, event.item, itemSiblings);
        const quality = ITEMXQuality.validateRecoveredItem(event, evidence);
        if (quality.status === 'rejected') {
          rejectedIds.push(event.item.id);
          continue;
        }
        const accepted =
          quality.status === 'partial' ? ITEMXQuality.projectSafePartial(event, quality, validationRegistry) : event;
        if (!acceptItemEvent(accepted)) continue;
        checkedIds.add(event.item.id);
        if (quality.status === 'partial') partials.push({ ...quality, event: accepted, sourceEvent: event });
      }
      let unresolvedPartials = partials;
      if (partials.length) {
        const partialMap = new Map(partials.map((one) => [one.event.item.id, one]));
        const repaired = new Map();
        try {
          const repairResponse = await runAuxModel(
            ITEMXQuality.repairPrompt(partials, committedNarrative),
            ITEMXText("aux.033")
          );
          const repairRaw = modelText(repairResponse);
          const repairParsed = repairRaw ? ITEMXCore.extractResponse(repairRaw, validationRegistry) : { events: [] };
          for (const event of repairParsed.events) {
            const accepted = ITEMXQuality.acceptRepair(event, partialMap, validationRegistry);
            if (!accepted || !acceptItemEvent(accepted)) continue;
            const fields = repaired.get(accepted.patch.id) || new Set();
            Object.keys(accepted.patch.fields || {}).forEach((key) => fields.add(key));
            repaired.set(accepted.patch.id, fields);
          }
        } catch (error) {
          fail('auxiliary partial repair', error);
        }
        unresolvedPartials = partials
          .map((one) => ({ ...one, missing: one.missing.filter((key) => !repaired.get(one.event.item.id)?.has(key)) }))
          .filter((one) => one.missing.length);
      }
      const skillEvidenceText = [conversation.triggeringUser, conversation.recent, committedNarrative]
        .filter(Boolean)
        .join('\n\n');
      const codexParsed = ITEMXCodex.extractResponse(parsed.content, codexSnapshot, {
        enabledDomains: domains,
        reconcileExistingSkills: true,
        suppressUnchanged: true,
        prepareEvent: (event, state) => (event.domain === 'monster' ? monsterReconciler(event, state) : event),
        rarityMode: settings.rarityMode,
        skillEvidenceText
      });
      const validationCodex = ITEMXCodex.clone(codexSnapshot);
      const validCodex = codexParsed.events.filter((event) => ITEMXCodex.applyEvent(validationCodex, event) != null);
      const valid = [...validItems, ...validCodex];
      debugRecord('auxiliary', {
        requested,
        events: valid.length,
        itemEvents: validItems.length,
        codexEvents: validCodex.length,
        partials: partials.length,
        partialFinal: unresolvedPartials.length,
        rejected: rejectedIds.length
      });
      const allErrors = [...parsed.errors, ...codexParsed.errors];
      if (!valid.length && allErrors.length) throw new Error(ITEMXText("aux.032", allErrors[0]));

      const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
      if (!latest || ITEMXCore.fnv1a(messageData(latest.message?.[index])) !== sourceHash) return null;
      if (!valid.length) {
        if (rejectedIds.length) {
          const next = ITEMXCore.clone(latest),
            history = auxiliaryHistory(next);
          history[guardKey] = {
            at: Date.now(),
            qualityRevision: ITEMXQuality.REVISION,
            state: 'rejected',
            events: 0,
            rejectedIds
          };
          next.scriptstate = {
            ...(next.scriptstate || {}),
            [ITEMX_AUX_KEY]: JSON.stringify(boundedObjectTail(history, 64, ITEMX_AUX_HISTORY_MAX_BYTES))
          };
          await saveChat(ctx.characterIndex, ctx.chatIndex, next, latest);
          if (pipelineState.activeContextKey === ctx.key) {
            uiState.status = ITEMXText("aux.031");
            await setAuxOutcome('failed', ITEMXText("aux.030"), 0);
          }
          return [];
        }
        await rememberAuxiliaryZero(ctx, guardKey);
        if (pipelineState.activeContextKey === ctx.key) {
          uiState.status = ITEMXText("aux.029");
          await setAuxOutcome('done', ITEMXText("aux.028"), 0);
        }
        return valid;
      }
      const next = ITEMXCore.clone(latest);
      const history = auxiliaryHistory(next);
      const reg = ITEMXCore.clone(snapshot.registry);
      const markers = validItems.map((event) => {
        const id = event.item?.id || event.patch?.id;
        const previous = ITEMXCore.comparisonView(reg.items[id]);
        const view = ITEMXCore.clone(ITEMXCore.applyEvent(reg, event));
        const partial = unresolvedPartials.find((one) => one.event.item.id === id);
        const review = { source: 'auxiliary', checked: checkedIds.has(id), missing: partial?.missing || [] };
        return ITEMXCore.marker({ v: ITEMXCore.VERSION, event, view, previous, review });
      });
      const codexReg = ITEMXCodex.clone(codexSnapshot);
      for (const event of validCodex) {
        const priorRegistry = event.domain === 'skill' ? codexReg.skills : codexReg.monsters;
        const previous = ITEMXCodex.clone(priorRegistry.entries[event.entity?.id || event.patch?.id] || null);
        const view = ITEMXCodex.clone(ITEMXCodex.applyEvent(codexReg, event));
        markers.push(
          ITEMXCodex.marker({ v: ITEMXCodex.VERSION, event, view, previous, review: { source: 'auxiliary' } })
        );
      }
      prepareInlinePortraits(ctx, codexReg, settings);
      const markerText = markers.join('\n');
      const message = next.message[index];
      if (typeof message?.data === 'string')
        message.data = positionMarkersByNarrative(`${message.data.trimEnd()}\n\n${markerText}`);
      else if (typeof message?.content === 'string')
        message.content = positionMarkersByNarrative(`${message.content.trimEnd()}\n\n${markerText}`);
      else return null;
      const record = {
        at: Date.now(),
        qualityRevision: ITEMXQuality.REVISION,
        state: unresolvedPartials.length || rejectedIds.length ? 'partial_final' : 'complete',
        events: valid.length,
        partialIds: [...unresolvedPartials.map((one) => one.event.item.id), ...rejectedIds]
      };
      history[guardKey] = record;
      next.scriptstate = {
        ...(next.scriptstate || {}),
        [ITEMX_AUX_KEY]: JSON.stringify(boundedObjectTail(history, 64, ITEMX_AUX_HISTORY_MAX_BYTES))
      };
      const compacted = compactMessageTransports(next, index).chat;
      const compactedLookup = buildMessageEventLookup(compacted);
      const rebuilt = rebuildWithManual(compacted, compactedLookup);
      const stillActive = pipelineState.activeContextKey === ctx.key;
      if (stillActive) {
        refreshLatest(compacted, compactedLookup);
        workQueue.remember('host-settling', ctx.key);
      }
      await saveChat(ctx.characterIndex, ctx.chatIndex, await enrichPendingChat(ctx, ITEMXCore.writeSnapshot(compacted, rebuilt)), latest);
      if (stillActive) {
        armEventBursts(markerText);
        commitEventBursts(compacted);
        pipelineState.cachedLoaded = null;
        pipelineState.generation += 1;
        workQueue.remember('host-settling', ctx.key);
        uiState.status = ITEMXText("aux.027", valid.length);
      }
      if (stillActive)
        await setAuxOutcome(
          unresolvedPartials.length || rejectedIds.length ? 'failed' : 'done',
          unresolvedPartials.length || rejectedIds.length
            ? ITEMXText("aux.026", unresolvedPartials.length + rejectedIds.length)
            : ITEMXText("aux.025", valid.length),
          valid.length
        );
      return valid;
    })().catch(async (error) => {
      fail('auxiliary recovery', error);
      if (pipelineState.activeContextKey === ctx.key) {
        uiState.status = ITEMXText("aux.024");
        await setAuxOutcome('failed', ITEMXText("aux.023", String(error?.message || error).slice(0, 80)));
      }
      return error?.code === 'AUX_PROVIDER_UNAVAILABLE' ? [] : null;
    });
  }

  async function runItemModel(task, loaded, target = null, instruction = '') {
    if (typeof Risuai.runLLMModel !== 'function') throw new Error(ITEMXText("aux.022"));
    const settings = await outputSettings(loaded.character);
    if (!settings.itemsEnabled) throw new Error(ITEMXText("aux.021"));
    const targetJson = target ? JSON.stringify(target) : 'null';
    const prompt = `${itemxProtocolText(settings.rarityMode)}\n\nYou are running a manual ITEMX management transaction. Output ITEMX transport only; no prose and no code fence.\n${task === 'create' ? 'Create exactly one genuinely new item from the user description. Emit exactly one complete itemExam with a new snake_case id.' : 'Reappraise exactly the supplied existing item. Emit exactly one complete itemExam, keep its id, possession, location, slot and count, and update descriptive/appraisal fields according to the instruction. Never remove it and never create another id.'}\n\nCURRENT INVENTORY:\n${ITEMXCore.anchor(loaded.snapshot)}\n\nTARGET ITEM JSON:\n${targetJson}\n\nUSER INSTRUCTION:\n${instruction || (task === 'create' ? 'Create a fitting new item.' : 'Roll a fresh appraisal while preserving established facts not contradicted by context.')}`;
    const response = await runAuxModel(prompt, task === 'create' ? ITEMXText("aux.020") : ITEMXText("aux.019"));
    const raw = modelText(response);
    if (!raw) throw new Error(ITEMXText("aux.018"));
    const parsed = ITEMXCore.extractResponse(raw, loaded.snapshot.registry);
    if (parsed.errors.length || parsed.events.length !== 1 || parsed.events[0].kind !== 'exam')
      throw new Error(ITEMXText("aux.017", parsed.errors[0] || `events=${parsed.events.length}`));
    const event = parsed.events[0];
    if (task === 'create') {
      if (loaded.snapshot.registry.items[event.item.id])
        throw new Error(ITEMXText("aux.016"));
      event.item.possession = 'owned';
      event.item.location = 'inventory';
      event.item.slot = null;
      event.item.count = Math.max(1, Number(event.item.count) || 1);
    } else {
      if (!target || event.item.id !== target.id) throw new Error(ITEMXText("aux.015"));
      event.item.possession = target.possession;
      event.item.location = target.location;
      event.item.slot = target.slot || null;
      event.item.count = target.count;
    }
    return event;
  }

  async function repairOneItem(loaded, id) {
    if (!loaded?.itemsEnabled) throw new Error(ITEMXText("aux.014"));
    if (!loaded || auxState.auxActive) throw new Error(ITEMXText("aux.013"));
    const record = presentationRecord('item', id);
    const missing = record.review?.missing || [];
    if (!missing.length) throw new Error(ITEMXText("aux.012"));

    return (async () => {
      const active = await context();
      if (!active || active.key !== loaded.key) throw new Error(ITEMXText("aux.011"));
      const chat = active.chat;
      if (chat.isStreaming || (chat.message || []).some((one) => one.isStreaming || one.bgContinue))
        throw new Error(ITEMXText("aux.010"));
      const sourceIndex = record.review?.evidenceIndex ?? record.messageIndex;
      const source = messageData(chat.message?.[sourceIndex]);
      const reg = rebuildWithManual(chat).registry,
        item = reg.items[id];
      if (!item || item.possession === 'removed') throw new Error(ITEMXText("aux.009"));
      const conversation = auxiliaryConversationContext(chat, sourceIndex);
      const narrative = [
        conversation.triggeringUser,
        conversation.recent,
        auxiliaryVisibleText(source, { itemRefs: false })
      ].join('\n\n');
      const evidence = ITEMXQuality.detectItemEvidence(narrative, item, Object.values(reg.items));
      if (!evidence.segment) throw new Error(ITEMXText("aux.008"));
      const partial = { event: { kind: 'exam', item }, missing, evidence };
      const raw = modelText(
        await runAuxModel(ITEMXQuality.repairPrompt([partial], narrative), ITEMXText("aux.007", item.name))
      );
      const parsed = ITEMXCore.extractResponse(raw, reg);
      const partialMap = new Map([[id, partial]]);
      const events = parsed.events.map((event) => ITEMXQuality.acceptRepair(event, partialMap, reg)).filter(Boolean);
      if (events.length !== 1 || parsed.events.length !== 1 || parsed.errors.length)
        throw new Error(ITEMXText("aux.006"));
      const latest = await context();
      if (!latest || latest.key !== loaded.key || JSON.stringify(latest.chat) !== JSON.stringify(chat))
        throw new Error(ITEMXText("aux.005"));
      const remaining = missing.filter((key) => !Object.prototype.hasOwnProperty.call(events[0].patch.fields, key));
      // This transaction already owns the queue; commitManualEvents only writes.
      await commitManualEvents(
        { ...loaded, chat: latest.chat, expectedChat: latest.chat },
        events,
        ITEMXText("aux.004"),
        { source: 'auxiliary', checked: true, missing: remaining, evidenceIndex: sourceIndex },
        false
      );
      if (pipelineState.activeContextKey === loaded.key)
        await setAuxOutcome(
          remaining.length ? 'failed' : 'done',
          remaining.length ? ITEMXText("aux.003", remaining.length) : ITEMXText("aux.002"),
          events.length
        );
    })()
      .then(() => rebuildCurrent())
      .catch(async (error) => {
        if (pipelineState.activeContextKey === loaded.key && !hostState.unloading)
          await setAuxOutcome('failed', ITEMXText("aux.001"), 0);
        throw error;
      })
      .finally(() => {});
  }
