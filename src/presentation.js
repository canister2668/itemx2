/* ITEMX presentation owner. Concatenated inside the runtime closure. */
  function codexInlineEventSignificant(payload) {
    const event = payload?.event;
    if (!event || !['skill', 'monster'].includes(event.domain)) return false;
    if (event.kind === 'exam') return true;
    if (event.kind !== 'patch') return false;
    if (event.patch?.action || ['remove', 'restore'].includes(event.patch?.op)) return true;
    const keys = new Set(Object.keys(event.patch?.fields || {}));
    const important =
      event.domain === 'skill'
        ? [
            'name',
            'rank',
            'school',
            'type',
            'status',
            'level',
            'mastery',
            'cost',
            'cooldown',
            'affinity',
            'effects',
            'growth'
          ]
        : ['name', 'kind', 'threat', 'relation', 'status', 'outcome', 'moves', 'weaknesses', 'resistances'];
    return important.some((key) => keys.has(key));
  }

  function codexInlineAppraisalStyle(entity, domain) {
    if (domain === 'skill') {
      const tier = skillRankTier(entity?.rank, 'world');
      const affinity = skillTheme(entity || {});
      return {
        tier,
        style: ITEMXRenderer.itemVars({ id: entity?.id, name: entity?.name, theme: 'arcane', rarity: tier, affinity })
      };
    }
    const level = encounterThreatLevel(entity?.threat);
    const tier = ['normal', 'rare', 'epic', 'legendary'][level] || 'normal';
    const relation = themeText(entity?.relation);
    const affinity = /hostile|적대|enemy/.test(relation) ? 'dark' : /spar|대련/.test(relation) ? 'light' : 'arcane';
    return {
      tier,
      style: ITEMXRenderer.itemVars({ id: entity?.id, name: entity?.name, theme: 'forged', rarity: tier, affinity })
    };
  }

  const INLINE_BODY = {
    fire: 'fire',
    blood: 'fire',
    lightning: 'bolt',
    light: 'bolt',
    dark: 'dark',
    void: 'dark',
    poison: 'haze',
    earth: 'haze',
    ice: 'haze',
    wind: 'haze',
    arcane: 'haze'
  };

  const codexInlineBody = (affinity) => {
    const kind = INLINE_BODY[affinity];
    return kind ? `<span class="itemx2-inline-body itemx2-inline-body-${kind}"></span>` : '';
  };

  const codexInlineStat = (label, value, from) => {
    const now = ITEMXCore.esc(value || ITEMXText("presentation.048"));
    const changed = from != null && String(from) !== '' && String(from) !== String(value);
    const body = changed ? `<s>${ITEMXCore.esc(from)}</s><u>→</u><em>${now}</em>` : `<span>${now}</span>`;
    return `<i class="${changed ? 'itemx2-inline-stat-changed' : ''}"><b>${ITEMXCore.esc(label)}</b>${body}</i>`;
  };

  function codexInlineEventHtml(payload, motion = 'full', portrait = '') {
    if (!codexInlineEventSignificant(payload)) return '';
    const event = payload.event,
      entity = payload.view || event.entity;
    if (!entity) return '';
    const previous = payload.previous || {},
      action = event.patch?.action || '',
      op = event.patch?.op || '';
    const ended = event.domain === 'monster' && /ended|escaped|defeated|dead/i.test(String(entity.status || ''));
    if (event.domain === 'skill') {
      const appraisal = codexInlineAppraisalStyle(entity, 'skill');
      const labels = {
        learn: ['SKILL LEARNED', ITEMXText("presentation.047")],
        equip: ['SKILL EQUIPPED', ITEMXText("presentation.046")],
        unequip: ['SKILL UPDATED', ITEMXText("presentation.045")],
        mastery: ['SKILL MASTERY UPDATED', ITEMXText("presentation.044")],
        seal: ['SKILL SEALED', ITEMXText("presentation.043")],
        unseal: ['SKILL UNSEALED', ITEMXText("presentation.042")],
        forget: ['SKILL LOST', ITEMXText("presentation.041")]
      };
      const [kicker, state] =
        event.kind === 'exam'
          ? ['NEW SKILL ARCHIVED', ITEMXText("presentation.040")]
          : labels[action] ||
            (op === 'remove'
              ? ['SKILL LOST', ITEMXText("presentation.039")]
              : op === 'restore'
                ? ['SKILL RESTORED', ITEMXText("presentation.038")]
                : ['SKILL RECORD UPDATED', ITEMXText("presentation.037")]);
      const mastery = entity.mastery != null && Number.isFinite(Number(entity.mastery)) ? Number(entity.mastery) : null;
      const priorMastery =
        previous.mastery != null && Number.isFinite(Number(previous.mastery)) ? Number(previous.mastery) : null;
      const quick = [
        [
          'LEVEL',
          entity.level == null ? ITEMXText("presentation.036") : `Lv.${entity.level}`,
          previous.level == null || previous.level === entity.level ? null : `Lv.${previous.level}`
        ],
        [ITEMXText("presentation.035"), mastery == null ? ITEMXText("presentation.034") : `${mastery}%`, priorMastery == null ? null : `${priorMastery}%`],
        [ITEMXText("presentation.033"), entity.cost || ITEMXText("presentation.032"), previous.cost || null],
        [ITEMXText("presentation.031"), entity.cooldown || ITEMXText("presentation.030"), previous.cooldown || null]
      ]
        .map(([label, value, from]) => codexInlineStat(label, value, from))
        .join('');
      const effect =
        (entity.effects || []).slice(0, 2).join(' · ') ||
        entity.description ||
        entity.growth ||
        ITEMXText("presentation.029");
      const classes = `itemx2-inline-event itemx2-inline-appraisal itemx2-inline-skill itemx2-inline-skill-theme-${skillTheme(entity)} itemx2-inline-tier-${appraisal.tier} ${motion === 'off' ? 'motion-off' : motion === 'lite' ? 'motion-lite' : ''}`;
      const meta = [
        entity.school || ITEMXText("presentation.028"),
        entity.type || 'active',
        entity.status || 'learned',
        entity.target ? ITEMXText("presentation.027", entity.target) : ''
      ]
        .filter(Boolean)
        .join(' · ');
      // The chips already carry every change, so the separate change block is gone.
      return `<section class="${classes}" style="${appraisal.style}">${codexInlineBody(entity.affinity)}<div class="itemx2-inline-main"><span class="itemx2-inline-icon"><span>${ITEMXCore.esc(skillEmoji(entity))}</span></span><span class="itemx2-inline-copy"><small class="itemx2-inline-kicker">${kicker}</small><strong class="itemx2-inline-name">${ITEMXCore.esc(entity.name || entity.id)}</strong><span class="itemx2-inline-meta">${ITEMXCore.esc([entity.rank, meta].filter(Boolean).join(' · '))}</span><span class="itemx2-inline-quick">${quick}</span></span><i class="itemx2-inline-state">${state}</i></div><footer class="itemx2-inline-foot"><b>${action === 'mastery' ? ITEMXText("presentation.026") : ITEMXText("presentation.025")}</b><span>${ITEMXCore.esc(effect)}</span><em class="itemx2-inline-more">CODEX &#8250;</em></footer></section>`;
    }
    const appraisal = codexInlineAppraisalStyle(entity, 'monster');
    const labels = {
      encounter: ['ENCOUNTER RESUMED', ITEMXText("presentation.024")],
      end: ['ENCOUNTER RESOLVED', ITEMXText("presentation.023")],
      escape: ['ENCOUNTER RESOLVED', ITEMXText("presentation.022")],
      defeat: ['ENCOUNTER RESOLVED', ITEMXText("presentation.021")],
      kill: ['ENCOUNTER RESOLVED', ITEMXText("presentation.020")],
      ally: ['ENCOUNTER UPDATED', ITEMXText("presentation.019")]
    };
    const [kicker, state] =
      event.kind === 'exam'
        ? ['ENCOUNTER REGISTERED', entity.status === 'active' ? ITEMXText("presentation.018") : ITEMXText("presentation.017")]
        : labels[action] ||
          (op === 'remove'
            ? ['ENCOUNTER LOST', ITEMXText("presentation.016")]
            : op === 'restore'
              ? ['ENCOUNTER RESTORED', ITEMXText("presentation.015")]
              : ['ENCOUNTER UPDATED', ITEMXText("presentation.014")]);
    const detail =
      entity.outcome || (entity.moves || []).slice(0, 3).join(' · ') || ITEMXText("presentation.013");
    const warning =
      entity.active && ['hostile', 'sparring'].includes(String(entity.relation || ''))
        ? '<span class="itemx2-inline-warning" aria-hidden="true"></span>'
        : '';
    const quick = [
      [ITEMXText("presentation.012"), entity.kind || ITEMXText("presentation.011"), null],
      [ITEMXText("presentation.010"), entity.threat || ITEMXText("presentation.009"), previous.threat || null],
      [ITEMXText("presentation.008"), entity.relation || 'unknown', previous.relation || null],
      [ITEMXText("presentation.007"), entity.status || 'unknown', previous.status || null]
    ]
      .map(([label, value, from]) => codexInlineStat(label, value, from))
      .join('');
    const classes = `itemx2-inline-event itemx2-inline-appraisal itemx2-inline-encounter itemx2-inline-tier-${appraisal.tier} ${ended ? 'itemx2-inline-ended' : ''} ${motion === 'off' ? 'motion-off' : motion === 'lite' ? 'motion-lite' : ''}`;
    const aliases = Array.isArray(entity.aliases) ? entity.aliases.slice(0, 2).join(' · ') : '';
    return ITEMXText("presentation.003", classes, appraisal.style, warning, ended ? '<span class="itemx2-inline-seal">&#35352;&#37636;</span>' : '<span class="itemx2-inline-scan"></span>', portrait ? `<img src="${ITEMXCore.esc(portrait)}" alt="" style="width:100%;height:100%;object-fit:cover">` : `<span>${ITEMXCore.esc(encounterEmoji(entity))}</span>`, kicker, ITEMXCore.esc(entity.name || entity.id), ITEMXCore.esc([entity.kind, aliases || entity.description].filter(Boolean).join(' · ') || ITEMXText("presentation.004")), quick, state, ended ? ITEMXText("presentation.006") : ITEMXText("presentation.005"), ITEMXCore.esc(detail));
  }

  function presentationPayloads(text) {
    const rows = [];
    String(text || '').replace(
      /<!--(ITEMX2|CODEX2)(?::([A-Za-z0-9_-]+)|@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?)-->/g,
      (raw, prefix, code, ref, inline, at) => {
        const domain = prefix === 'ITEMX2' ? 'item' : 'codex';
        const payload = code
          ? (domain === 'item' ? ITEMXCore : ITEMXCodex).decodePayload(code)
          : pipelineState.eventPayloads.get(`${domain}:${ref}`) || inlineViewPayload(inline, domain);
        if (payload?.view && !payload.error)
          rows.push({ payload, domain: domain === 'codex' ? payload.event?.domain : 'item', at });
        return raw;
      }
    );
    return rows;
  }

  function eventBurstKey(payload) {
    return `e${ITEMXCore.fnv1a(pipelineState.activeContextKey)}_${ITEMXCore.fnv1a(JSON.stringify([payload.event, payload.view]))}`;
  }

  function decorateInlineEvent(html, payload, domain) {
    const kind = ITEMXRenderer.eventKind(payload, domain);
    if (!kind || !html) return html;
    return html.replace(/^<(article|section)([^>]*)>/, (opening) =>
      opening.replace(
        />$/,
        ` x-itemx2-event="${eventBurstKey(payload)}"><span class="itemx2-event-burst itemx2-burst-${kind}" aria-hidden="true"></span>`
      )
    );
  }

  function armEventBursts(text) {
    if (!presentationState.visualEffectsEnabled || hostState.unloading) return;
    for (const [key, candidate] of presentationState.eventBursts)
      if (candidate.expires < Date.now()) presentationState.eventBursts.delete(key);
    for (const { payload, domain } of presentationPayloads(text)) {
      if (!ITEMXRenderer.eventKind(payload, domain)) continue;
      const key = eventBurstKey(payload);
      if (presentationState.eventBurstSeen.has(key) || presentationState.eventBursts.has(key)) continue;
      if (presentationState.eventBursts.size >= 8) break;
      presentationState.eventBursts.set(key, { expires: Date.now() + 30000, committed: false });
    }
  }

  function burstTimer(fn, ms) {
    return workQueue.later('burst', fn, ms);
  }

  function commitEventBursts(chat) {
    if (!presentationState.eventBursts.size || chat?.isStreaming) return;
    const message = chat?.message?.[assistantMessageIndex(chat)];
    if (!message || message.isStreaming || message.bgContinue) return;
    let activated = false;
    for (const { payload } of presentationPayloads(messageData(message))) {
      const candidate = presentationState.eventBursts.get(eventBurstKey(payload));
      if (!candidate || candidate.committed || candidate.expires < Date.now()) continue;
      candidate.committed = true;
      candidate.expires = Date.now() + 3000;
      activated = true;
    }
    if (activated) for (const delayMs of [0, 350, 1000]) burstTimer(flushEventBursts, delayMs);
  }

  async function flushEventBursts() {
    if (hostState.unloading || !hostState.mainDoc || presentationState.bodyFxScrollActive || !presentationState.eventBursts.size) return;

    const key = pipelineState.activeContextKey;
    try {
      let played = 0;
      for (const [id, candidate] of presentationState.eventBursts) {
        if (candidate.expires < Date.now() || !presentationState.visualEffectsEnabled) {
          presentationState.eventBursts.delete(id);
          continue;
        }
        if (!candidate.committed || played >= 2) continue;
        const element = await hostState.mainDoc.querySelector(`[x-itemx2-event="${id}"]`);
        if (hostState.unloading || key !== pipelineState.activeContextKey) return;
        if (!element) continue;
        // Consume before mutating DOM. Re-rendered markup never contains this class.
        presentationState.eventBursts.delete(id);
        presentationState.eventBurstSeen.add(id);
        while (presentationState.eventBurstSeen.size > 256)
          presentationState.eventBurstSeen.delete(presentationState.eventBurstSeen.values().next().value);
        presentationState.eventBurstOwners.add(element);
        await element.addClass('x-risu-itemx2-burst-active');
        if (hostState.unloading || key !== pipelineState.activeContextKey) {
          await element.removeClass('x-risu-itemx2-burst-active');
          presentationState.eventBurstOwners.delete(element);
          return;
        }
        played++;
        burstTimer(async () => {
          try {
            await element.removeClass('x-risu-itemx2-burst-active');
          } catch {}
          presentationState.eventBurstOwners.delete(element);
        }, 1350);
      }
    } catch (error) {
      debugRecord('event burst', error?.message || String(error));
    }
  }

  function clearEventBursts() {
    workQueue.clearGroup('burst');
    presentationState.eventBursts.clear();
    for (const element of presentationState.eventBurstOwners)
      void element.removeClass('x-risu-itemx2-burst-active').catch(() => {});
    presentationState.eventBurstOwners.clear();
  }

  function suppressRepeatedDisplayStates(content) {
    // Display-only: never delete ledger events. A -> B -> A remains three states.
    const last = new Map();
    return String(content || '').replace(
      /<!--(ITEMX2|CODEX2)([:@])([A-Za-z0-9_-]+)(?::([A-Za-z0-9_-]+))?-->/g,
      (raw, prefix, mode, code, inline) => {
        const domain = prefix === 'ITEMX2' ? 'item' : 'codex';
        const payload =
          mode === ':'
            ? ITEMXCore.decodePayload(code)
            : pipelineState.eventPayloads.get(`${domain}:${code}`) || inlineViewPayload(inline, domain);
        const view = payload?.view;
        if (!view?.id || payload.error) return raw;
        const key = `${domain}:${payload.event?.domain || 'item'}:${view.id}`;
        const signature = eventValueKey(view);
        const duplicate = last.get(key) === signature;
        last.set(key, signature);
        return duplicate ? '' : raw;
      }
    );
  }

  const displayHandler = (content, portraits = {}) => {
    const raw = ITEMXCore.stripInventoryEcho(content);
    if (!raw.includes('<!--ITEMX2') && !raw.includes('<!--CODEX2')) return raw;
    const positioned =
      raw.includes('<!--ITEMX2:') || raw.includes('<!--CODEX2:') ? positionMarkersByNarrative(raw) : raw;
    const source = coalesceAdjacentItemMarkers(suppressRepeatedDisplayStates(positioned));
    let found = false,
      hasFullCard = false,
      hasCodexCard = false;
    const renderPayload = (cacheKey, payload, motion) => {
      const key = `${cacheKey}:${motion}`;
      if (presentationState.markerHtmlCache.has(key)) return presentationState.markerHtmlCache.get(key);
      const html = decorateInlineEvent(
        ITEMXRenderer.renderMarkerPayload(payload, { inline: true, motion }),
        payload,
        'item'
      );
      presentationState.markerHtmlCache.set(key, html);
      while (presentationState.markerHtmlCache.size > 64)
        presentationState.markerHtmlCache.delete(presentationState.markerHtmlCache.keys().next().value);
      return html;
    };
    const markerMotion = (key) => {
      if (!presentationState.visualEffectsEnabled) return 'off';
      if (!pipelineState.latestMarkers.size) return 'lite';
      return pipelineState.latestMarkers.has(key) ? 'lite' : 'off';
    };
    const rendered = source
      .replace(ITEMXCore.MARKER_RE, (_, code) => {
        found = true;
        const payload = ITEMXCore.decodePayload(code);
        if (!payload || payload.error) return '';
        const motion = markerMotion(`ITEMX2:${code}`);
        const html = renderPayload(`item:${code}`, payload, motion);
        if (html) {
          hasFullCard = true;
          return html;
        }
        const item = payload.event?.kind === 'exam' ? payload.event.item : payload.view;
        return item
          ? `<span class="itemx-event-chip">${ITEMXCore.esc(ITEMXCore.resolveItemEmoji(item))} ${ITEMXCore.esc(item.name || item.id)}</span>`
          : '';
      })
      .replace(ITEMXCodex.MARKER_RE, (_, code) => {
        found = true;
        const payload = ITEMXCodex.decodePayload(code);
        if (!payload || payload.error) return '';
        const html = decorateInlineEvent(
          codexInlineEventHtml(
            payload,
            markerMotion(`CODEX2:${code}`),
            portraits[payload.view?.id || payload.event?.entity?.id] || ''
          ),
          payload,
          payload.event?.domain
        );
        if (html) {
          hasCodexCard = true;
          return html;
        }
        return '';
      })
      .replace(ITEMX_REF_RE, (_, ref, inline) => {
        found = true;
        const payload = pipelineState.eventPayloads.get(`item:${ref}`) || inlineViewPayload(inline, 'item');
        if (!payload || payload.error) return ITEMXText("presentation.002");
        const motion = markerMotion(`ITEMX2@${ref}`);
        const html = renderPayload(`item-ref:${ref}`, payload, motion);
        if (html) {
          hasFullCard = true;
          return html;
        }
        const item = payload.view || payload.event?.item;
        return item
          ? `<span class="itemx-event-chip">${ITEMXCore.esc(ITEMXCore.resolveItemEmoji(item))} ${ITEMXCore.esc(item.name || item.id)}</span>`
          : `<span class="itemx-event-chip">📦 ITEMX CODEX · ${ITEMXCore.esc(ref)}</span>`;
      })
      .replace(ITEMX_CODEX_REF_RE, (_, ref, inline) => {
        found = true;
        if (!inline && !pipelineState.latestMarkers.has(`CODEX2@${ref}`)) return '';
        const payload = pipelineState.eventPayloads.get(`codex:${ref}`) || inlineViewPayload(inline, 'codex');
        if (!payload || payload.error) return inline ? ITEMXText("presentation.001") : '';
        const html = decorateInlineEvent(
          codexInlineEventHtml(
            payload,
            markerMotion(`CODEX2@${ref}`),
            portraits[payload.view?.id || payload.event?.entity?.id] || ''
          ),
          payload,
          payload.event?.domain
        );
        if (html) {
          hasCodexCard = true;
          return html;
        }
        return '';
      });
    if (!found) return source;
    if (hostState.mainStyle) return rendered;
    return `<style>${ITEMX_CHIP_STYLE}${ITEMX_PRESENTATION_STYLE}${hasFullCard ? ITEMX_CHAT_STYLE : ''}${hasCodexCard ? `${ITEMX_CODEX_INLINE_STYLE}${ITEMX_CODEX_INLINE_DENSE_STYLE}${ITEMX_CODEX_INLINE_APPRAISAL_STYLE}` : ''}</style>${rendered}`;
  };

  function displayWithPortraits(content) {
    const monsters = {};
    const collect = (payload) => {
      if (payload?.event?.domain !== 'monster' || payload.error) return;
      const entity = payload.view || payload.event.entity;
      if (entity?.id) monsters[entity.id] = entity;
    };
    String(content || '').replace(ITEMXCodex.MARKER_RE, (_, code) => {
      collect(ITEMXCodex.decodePayload(code));
      return '';
    });
    String(content || '').replace(ITEMX_CODEX_REF_RE, (_, ref, inline) => {
      collect(pipelineState.eventPayloads.get(`codex:${ref}`) || inlineViewPayload(inline, 'codex'));
      return '';
    });
    const portraits = {},
      cached = portraitsState.inlinePortraitCatalog;
    // Display hooks must never call back into the host. A host render may be
    // waiting for this callback, and concurrent message renders amplify reads.
    if (cached?.contextKey === pipelineState.activeContextKey) {
      for (const entity of Object.values(monsters)) {
        const asset = ITEMXCodex.assetForEntity(cached.catalog, entity, cached.narrative);
        if (!asset) continue;
        const cacheKey = `${cached.characterId}:${asset.id}:${asset.ext || ''}`;
        const image = portraitsState.portraitThumbnailCache.get(cacheKey);
        if (typeof image === 'string' && image) portraits[entity.id] = image;
      }
    }
    return displayHandler(content, portraits);
  }

  function beginBodyScrollEffects() {
    presentationState.bodyFxSawScroll = false;
    workQueue.clearTimer('bodyFxStartTimer');
    workQueue.schedule(
      'bodyFxStartTimer',
      () => {
        activateBodyScrollEffects();
      },
      80,
      false
    );
  }

  function activateBodyScrollEffects() {
    if (presentationState.bodyFxScrollActive || !presentationState.bodyFxClassOwner) return;
    presentationState.bodyFxScrollActive = true;
    void presentationState.bodyFxClassOwner.addClass('x-risu-itemx-body-scrolling').catch(() => {});
  }

  function continueBodyScrollEffects() {
    presentationState.bodyFxSawScroll = true;
    workQueue.clearTimer('bodyFxStartTimer');
    activateBodyScrollEffects();
    endBodyScrollEffects(220);
  }

  function endBodyScrollEffects(delayMs = 0) {
    workQueue.clearTimer('bodyFxStartTimer');
    workQueue.clearTimer('bodyFxScrollTimer');
    workQueue.schedule(
      'bodyFxScrollTimer',
      () => {
        if (!presentationState.bodyFxScrollActive) return;
        presentationState.bodyFxScrollActive = false;
        if (presentationState.bodyFxClassOwner)
          void presentationState.bodyFxClassOwner.removeClass('x-risu-itemx-body-scrolling').catch(() => {});
        scheduleHostDomSync(180);
        workQueue.wake();
      },
      delayMs,
      false
    );
  }

  async function removeBodyEffectGovernor() {
    const owner = presentationState.bodyFxEventIds[0]?.owner;
    if (owner)
      for (const binding of presentationState.bodyFxEventIds) {
        try {
          await owner.removeEventListener(binding.type, binding.id, true);
        } catch (error) {
          debugRecord('body effect listener remove', error?.message || String(error));
        }
      }
    presentationState.bodyFxEventIds = [];
  }

  async function installBodyEffectGovernor() {
    if (!hostState.mainDoc) return;
    try {
      presentationState.bodyFxClassOwner = (await hostState.mainDoc.querySelector('.chattext')) || presentationState.bodyFxClassOwner;
      if (presentationState.bodyFxEventIds[0]?.owner) {
        try {
          if (await presentationState.bodyFxEventIds[0]?.owner.getParent()) return;
        } catch {}
        await removeBodyEffectGovernor();
      }
      const body = await hostState.mainDoc.querySelector('body');
      if (!body) return;
      const bindings = [
        ['pointerdown', beginBodyScrollEffects],
        ['scroll', continueBodyScrollEffects],
        ['pointerup', () => endBodyScrollEffects(presentationState.bodyFxSawScroll ? 220 : 40)],
        ['pointercancel', () => endBodyScrollEffects(presentationState.bodyFxSawScroll ? 220 : 40)],
        ['scrollend', () => endBodyScrollEffects(40)]
      ];
      for (const [type, handler] of bindings) {
        const id = await body.addEventListener(type, entry('scroll', handler), true);
        presentationState.bodyFxEventIds.push({ owner: body, type, id });
      }
    } catch (error) {
      debugRecord('body effect governor install', error?.message || String(error));
    }
  }
