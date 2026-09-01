/* Build placeholders are replaced by scripts/build.mjs. */
const ITEMX_STYLE = __ITEMX_STYLE_JSON__;
const ITEMX_CHAT_STYLE = __ITEMX_CHAT_STYLE_JSON__;
const ITEMX_MAIN_STYLE = __ITEMX_MAIN_STYLE_JSON__;
const ITEMX_CHIP_STYLE = '.itemx-event-chip{display:inline-flex;align-items:center;max-width:100%;margin:.28em .2em;padding:.28em .58em;border:1px solid rgba(126,145,174,.26);border-radius:999px;background:rgba(18,25,38,.72);color:#dce6f4;font-size:.76rem;font-weight:700;line-height:1.35;vertical-align:middle}';
const ITEMX_PROTOCOL_TEXT = __ITEMX_PROTOCOL_JSON__;
const ITEMX_PLUGIN_VERSION = '1.9.0-beta.5';
const ITEMX_VERSION_LABEL = '1.9 · BETA 5';
const ITEMX_UPDATE_URL = 'https://raw.githubusercontent.com/canister2668/itemx2/main/dist/itemx2.plugin.js';
const ITEMX_UPDATE_CACHE_KEY = 'itemx2:update-check';
const ITEMX_UPDATE_CHECK_MS = 30 * 60 * 1000;
const ITEMX_MANUAL_KEY = '$__itemx2_manual_events';
const ITEMX_MESSAGE_EVENT_KEY = '$__itemx2_message_events';
const ITEMX_AUX_KEY = '$__itemx2_aux_processed';
const ITEMX_REF_RE = /<!--ITEMX2@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?-->/g;
const ITEMX_CODEX_REF_RE = /<!--CODEX2@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?-->/g;
const ITEMX_AUX_SETTLE_MS = 1500;
const ITEMX_ROOT_PAGE_SIZE = 16;
const ITEMX_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="176" viewBox="0 0 48 176" role="img" aria-label="ITEMX inventory"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#1b2940"/><stop offset="1" stop-color="#090d17"/></linearGradient><filter id="s" x="-40%" y="-20%" width="180%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-opacity=".52"/></filter></defs><g filter="url(#s)"><rect x="1" y="1" width="46" height="174" rx="10" fill="url(#g)" stroke="#536684" stroke-width="1.2"/><path d="M2 35h44M2 141h44" stroke="#263650" stroke-width="1"/></g><text x="24" y="26" text-anchor="middle" font-size="17">📦</text><text x="24" y="88" text-anchor="middle" dominant-baseline="middle" transform="rotate(90 24 88)" fill="#f1f5fc" font-family="Arial,sans-serif" font-size="8.5" font-weight="900" letter-spacing="1.35">INVENTORY</text><path d="M17 154h14M24 147v14" fill="none" stroke="#9abcf4" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const ITEMX_BADGE_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ITEMX_BADGE_SVG)}`;

(async () => {
  'use strict';
  const queues = new Map();
  const ui = { tab: 'inventory', filter: 'all', query: '', selected: null, selectedSkill: null, selectedMonster: null, manageId: null, motion: true };
  const runtime = {
    latestMarkers: new Set(), latestOutput: '', pendingMarkers: new Set(), pendingMarkersAt: 0, eventPayloads: new Map(), markerHtmlCache: new Map(), detailHtmlCache: new Map(), cachedLoaded: null, cachedGeneration: -1, portraitCache: new Map(), portraitCacheBytes: 0, mainStyle: null, mainStylePosition: '', mainDoc: null, rootDrawer: null, rootFingerprint: '', rootContentReady: false, activeRootTab: 'inventory', rootItemPage: 0, rootTabBusy: false, badgeEventOwner: null, badgeEventId: null, bodyFxEventOwner: null, bodyFxEventIds: [], bodyFxClassOwner: null, bodyFxStartTimer: null, bodyFxScrollTimer: null, bodyFxScrollActive: false, uiParts: [], generation: 0, remountTimer: null, remountFallbackAt: 0, catchUpTimer: null, updateTimer: null, hostObserver: null, hostSyncTimer: null, hostSyncBusy: false, feedbackTimer: null, catchUpFingerprint: '', catchUpFailedFingerprint: '', catchUpFailures: 0, catchUpRetryAt: 0, auxCandidateFingerprint: '', auxCandidateSince: 0, auxCandidateChecks: 0, legacyCommitTimer: null, remounting: false, hookInstallPromise: null, connectionBusy: false, settingChangeBusy: false, auxRecoveryPromise: null,
    status: 'UI 준비', lastDomError: '', lastHookError: '', hooks: { output: false, display: false, before: false, after: false, listener: false },
    permissions: { replacer: null, mainDom: null }, badgePosition: 'lb', compactContainer: true,
    panelOpen: false, panelTransition: 0, auxActive: 0, auxLabel: '보조 모델 처리 중', auxToastTimer: null, uiRemountAfter: 0, hostSettingsVisible: false, allowDrawerOverSettings: false, activeContextKey: '',
    auxLast: { state: 'idle', label: '아직 실행 기록 없음', at: 0, events: null }, update: { checking: false, checkedAt: 0, latest: '', available: false }, debugEnabled: false, debugEntries: []
  };

  const log = (...args) => console.log('[ITEMX 2]', ...args);
  const debugRecord = (where, detail = '') => {
    if (!runtime.debugEnabled) return;
    const text = typeof detail === 'string' ? detail : JSON.stringify(detail);
    runtime.debugEntries.push({ at: Date.now(), where: String(where), detail: String(text || '').slice(0, 500) });
    if (runtime.debugEntries.length > 30) runtime.debugEntries.splice(0, runtime.debugEntries.length - 30);
    console.log(`[ITEMX 2 · DEBUG] ${where}`, detail);
  };
  const fail = (where, error) => { debugRecord(`ERROR · ${where}`, error?.message || String(error)); console.error(`[ITEMX 2] ${where}`, error); };
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function withTimeout(promise, timeoutMs, message) {
    let timer = null;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => { timer = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs); })
      ]);
    } finally {
      if (timer) globalThis.clearTimeout(timer);
    }
  }
  function compareVersions(left, right) {
    const parse = (value) => {
      const [main, prerelease = ''] = String(value || '').trim().replace(/^v/i, '').split('-', 2);
      return { main: main.split('.').map((part) => Number.parseInt(part, 10) || 0), pre: prerelease ? prerelease.split('.') : [] };
    };
    const a = parse(left), b = parse(right);
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
    if (!runtime.mainDoc || !runtime.rootDrawer) return;
    try {
      const current = await runtime.mainDoc.querySelector('.x-risu-itemx2-update-indicator');
      const currentLabel = await runtime.mainDoc.querySelector('.x-risu-itemx2-update-label');
      if (!runtime.update.available) {
        if (current) await current.remove();
        if (currentLabel) await currentLabel.remove();
        return;
      }
      if (current) {
        await current.setAttribute('x-itemx2-update', runtime.update.latest);
      } else {
        const badge = await runtime.mainDoc.querySelector('.x-risu-itemx2-native-badge');
        if (badge) {
          const indicator = await runtime.mainDoc.createElement('span');
          await indicator.setClassName('x-risu-itemx2-update-indicator');
          await indicator.setAttribute('x-itemx2-update', runtime.update.latest);
          await indicator.setTextContent('↑');
          await badge.appendChild(indicator);
        }
      }
      if (!currentLabel) {
        const eyebrow = await runtime.mainDoc.querySelector('.x-risu-itemx-ph-eyebrow');
        if (eyebrow) {
          const label = await runtime.mainDoc.createElement('span');
          await label.setClassName('x-risu-itemx2-update-label');
          await label.setAttribute('x-itemx2-update', runtime.update.latest);
          await label.setTextContent('UPDATE');
          await eyebrow.appendChild(label);
        }
      }
    } catch (error) { fail('update indicator', error); }
  }
  async function checkForUpdate() {
    if (runtime.update.checking || !runtime.activeContextKey || typeof Risuai.nativeFetch !== 'function') return;
    runtime.update.checking = true;
    try {
      let cached = null;
      try { cached = JSON.parse(await Risuai.safeLocalStorage.getItem(ITEMX_UPDATE_CACHE_KEY) || 'null'); } catch {}
      if (cached?.latest) {
        runtime.update.checkedAt = Number(cached.checkedAt) || 0;
        runtime.update.latest = String(cached.latest);
        runtime.update.available = compareVersions(runtime.update.latest, ITEMX_PLUGIN_VERSION) > 0;
        await syncUpdateIndicator();
      }
      if (Date.now() - runtime.update.checkedAt < ITEMX_UPDATE_CHECK_MS) return;
      const response = await withTimeout(Risuai.nativeFetch(ITEMX_UPDATE_URL, {
        method: 'GET', headers: { Range: 'bytes=0-2047' }, cache: 'no-store'
      }), 6000, '업데이트 확인 시간이 초과되었습니다');
      if (!response?.ok) throw new Error(`업데이트 서버 응답 ${response?.status || '없음'}`);
      const header = String(await response.text() || '');
      const latest = header.match(/^\/\/@version\s+([^\s]+)\s*$/m)?.[1] || '';
      if (!latest) throw new Error('업데이트 버전 헤더를 찾지 못했습니다');
      runtime.update.checkedAt = Date.now();
      runtime.update.latest = latest;
      runtime.update.available = compareVersions(latest, ITEMX_PLUGIN_VERSION) > 0;
      try {
        await Risuai.safeLocalStorage.setItem(ITEMX_UPDATE_CACHE_KEY, JSON.stringify({ checkedAt: runtime.update.checkedAt, latest }));
      } catch {}
      await syncUpdateIndicator();
    } catch (error) {
      debugRecord('update check', error?.message || String(error));
    } finally {
      runtime.update.checking = false;
    }
  }
  const messageData = (message) => ITEMXCore.messageText(message);
  const markerCodes = (text) => {
    const out = new Set();
    String(text || '').replace(ITEMXCore.MARKER_RE, (_, code) => { out.add(`ITEMX2:${code}`); return ''; });
    String(text || '').replace(ITEMXCodex.MARKER_RE, (_, code) => { out.add(`CODEX2:${code}`); return ''; });
    String(text || '').replace(ITEMX_REF_RE, (_, ref) => { out.add(`ITEMX2@${ref}`); return ''; });
    String(text || '').replace(ITEMX_CODEX_REF_RE, (_, ref) => { out.add(`CODEX2@${ref}`); return ''; });
    return out;
  };

  async function context() {
    try {
      const [characterIndex, chatIndex, character] = await Promise.all([
        Risuai.getCurrentCharacterIndex(), Risuai.getCurrentChatIndex(), Risuai.getCharacter()
      ]);
      if (characterIndex == null || chatIndex == null || !character) return null;
      const chat = await Risuai.getChatFromIndex(characterIndex, chatIndex);
      if (!chat) return null;
      return { characterIndex, chatIndex, character, chat, key: `${character.chaId || characterIndex}:${chat.id || chatIndex}` };
    } catch (error) {
      // PocketRisu has no current chatPage on Home. A globally loaded plugin
      // must treat that route as an idle state, not as an initialization error.
      if (!/chatPage|current chat|undefined/i.test(String(error?.message || error))) fail('active chat context', error);
      return null;
    }
  }

  async function isEnabled(character) {
    const key = `enabled:${character?.chaId || 'unknown'}`;
    const value = await Risuai.pluginStorage.getItem(key);
    return value !== '0';
  }

  async function setEnabled(character, value) {
    await Risuai.pluginStorage.setItem(`enabled:${character?.chaId || 'unknown'}`, value ? '1' : '0');
  }

  async function outputSettings(character) {
    const id = character?.chaId || 'unknown';
    const [main, aux, rarity, items, skills, encounters, debug] = await Promise.all([
      Risuai.pluginStorage.getItem(`mainOutput:${id}`),
      Risuai.pluginStorage.getItem(`auxOutput:${id}`),
      Risuai.pluginStorage.getItem(`rarityMode:${id}`),
      Risuai.pluginStorage.getItem(`itemsEnabled:${id}`),
      Risuai.pluginStorage.getItem(`skillsEnabled:${id}`),
      Risuai.pluginStorage.getItem(`encountersEnabled:${id}`),
      Risuai.pluginStorage.getItem(`debugEnabled:${id}`)
    ]);
    return {
      mainOutput: main !== '0',
      auxOutput: ['off', 'missing', 'always'].includes(aux) ? aux : 'missing',
      rarityMode: ['world', 'itemx'].includes(rarity) ? rarity : 'world',
      itemsEnabled: items !== '0', skillsEnabled: skills !== '0', encountersEnabled: encounters !== '0', debugEnabled: debug === '1'
    };
  }

  async function setDomainEnabled(character, domain, value) {
    const keys = { items: 'itemsEnabled', skills: 'skillsEnabled', encounters: 'encountersEnabled' };
    if (!keys[domain]) throw new Error('Invalid ITEMX domain');
    await Risuai.pluginStorage.setItem(`${keys[domain]}:${character?.chaId || 'unknown'}`, value ? '1' : '0');
    runtime.catchUpFingerprint = ''; runtime.catchUpFailedFingerprint = ''; runtime.auxCandidateFingerprint = '';
  }

  async function setDebugEnabled(character, value) {
    runtime.debugEnabled = Boolean(value);
    await Risuai.pluginStorage.setItem(`debugEnabled:${character?.chaId || 'unknown'}`, value ? '1' : '0');
    debugRecord('debug', value ? 'enabled' : 'disabled');
  }

  async function setMainOutput(character, value) {
    await Risuai.pluginStorage.setItem(`mainOutput:${character?.chaId || 'unknown'}`, value ? '1' : '0');
  }

  async function setAuxOutput(character, value) {
    if (!['off', 'missing', 'always'].includes(value)) throw new Error('Invalid auxiliary output mode');
    await Risuai.pluginStorage.setItem(`auxOutput:${character?.chaId || 'unknown'}`, value);
    runtime.catchUpFingerprint = ''; runtime.catchUpFailedFingerprint = ''; runtime.auxCandidateFingerprint = '';
  }

  async function setRarityMode(character, value) {
    if (!['world', 'itemx'].includes(value)) throw new Error('Invalid rarity mode');
    await Risuai.pluginStorage.setItem(`rarityMode:${character?.chaId || 'unknown'}`, value);
  }

  const AUX_LABELS = { off: '끔', missing: '누락 시', always: '항상 검토' };
  const RARITY_MODE_LABELS = { world: '세계관 우선', itemx: 'ITEMX 강제' };

  function itemxProtocolText(rarityMode = 'world') {
    const policy = rarityMode === 'itemx'
      ? `## ITEMX Rarity Policy: FORCED\nITEMX rarity is an internal relative power and visual tier, not necessarily the world's printed grade name. Preserve the setting's local grade wording in display. An explicit user-requested ITEMX tier always wins. When the narrative conclusively establishes a newly appraised item as the setting's absolute highest grade, ultimate pinnacle, server/world-unique apex, or beyond the existing grade system, emit rarity=empyrean even if the setting calls that grade Epic; keep the local wording and distinction in display. Use mythical or legendary for clearly lower relative standings. Do not promote from ornate prose alone: the apex standing must be settled by the narrative.`
      : `## ITEMX Rarity Policy: WORLD FIRST\nTreat the setting's literal item grade as authoritative. Map its stated grade to the nearest literal ITEMX rarity and do not promote it merely because it is described as the setting's best. Preserve the local grade wording in display.`;
    return `${ITEMX_PROTOCOL_TEXT}\n\n${policy}`;
  }

  const enabledCodexDomains = (settings) => [settings.skillsEnabled && 'skill', settings.encountersEnabled && 'monster'].filter(Boolean);
  const stripItemTransport = (content) => ITEMXCore.extractResponse(String(content || ''), ITEMXCore.newRegistry()).content.replace(ITEMXCore.MARKER_RE, '');
  const stripAllTransport = (content) => ITEMXCodex.extractResponse(stripItemTransport(content), ITEMXCodex.snapshot(), { enabledDomains: [] }).content.replace(ITEMXCodex.MARKER_RE, '');
  function protocolForSettings(settings, character) {
    const parts = [];
    if (settings.itemsEnabled) parts.push(itemxProtocolText(settings.rarityMode));
    const domains = enabledCodexDomains(settings);
    if (domains.length) parts.push(ITEMXCodex.protocol(ITEMXCodex.assetCatalog(character).map((row) => row.name), { enabledDomains: domains }));
    return parts.join('\n\n');
  }

  const BADGE_POSITIONS = [
    ['lb', '좌하'], ['lm', '좌중'], ['lt', '좌상'],
    ['rb', '우하'], ['rm', '우중'], ['rt', '우상']
  ];

  async function loadBadgePosition() {
    const saved = await Risuai.pluginStorage.getItem('badgePosition');
    if (BADGE_POSITIONS.some(([value]) => value === saved)) runtime.badgePosition = saved;
  }

  function badgeStyle() {
    const positions = {
      lb: 'left:4px!important;right:auto!important;top:auto!important;bottom:calc(5.2rem + env(safe-area-inset-bottom,0px))!important;transform:none!important;border-radius:0 8px 8px 0!important',
      lm: 'left:4px!important;right:auto!important;top:50%!important;bottom:auto!important;transform:translateY(-50%)!important;border-radius:0 8px 8px 0!important',
      lt: 'left:4px!important;right:auto!important;top:calc(4.5rem + env(safe-area-inset-top,0px))!important;bottom:auto!important;transform:none!important;border-radius:0 8px 8px 0!important',
      rb: 'right:4px!important;left:auto!important;top:auto!important;bottom:calc(5.2rem + env(safe-area-inset-bottom,0px))!important;transform:none!important;border-radius:8px 0 0 8px!important',
      rm: 'right:4px!important;left:auto!important;top:50%!important;bottom:auto!important;transform:translateY(-50%)!important;border-radius:8px 0 0 8px!important',
      rt: 'right:4px!important;left:auto!important;top:calc(4.5rem + env(safe-area-inset-top,0px))!important;bottom:auto!important;transform:none!important;border-radius:8px 0 0 8px!important'
    };
    const button = 'button[aria-label="ITEMX"],button:has(img[src*="ITEMX%20inventory"])';
    const states = 'button[aria-label="ITEMX"]:hover,button[aria-label="ITEMX"]:active,button[aria-label="ITEMX"]:focus,button:has(img[src*="ITEMX%20inventory"]):hover,button:has(img[src*="ITEMX%20inventory"]):active,button:has(img[src*="ITEMX%20inventory"]):focus';
    const wrappers = 'button[aria-label="ITEMX"]>div,button:has(img[src*="ITEMX%20inventory"])>div';
    const images = 'button[aria-label="ITEMX"] img,button:has(img[src*="ITEMX%20inventory"]) img[src*="ITEMX%20inventory"]';
    return `${button}{${positions[runtime.badgePosition] || positions.lb};display:flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;width:48px!important;height:176px!important;min-width:48px!important;min-height:176px!important;padding:0!important;overflow:visible!important;border:0!important;outline:0!important;background:none!important;background-color:transparent!important;box-shadow:none!important;cursor:pointer!important;touch-action:manipulation!important;z-index:50!important}${states}{background:none!important;background-color:transparent!important;box-shadow:none!important}${wrappers}{display:block!important;box-sizing:border-box!important;width:48px!important;height:176px!important;min-width:48px!important;min-height:176px!important;padding:0!important;overflow:visible!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important}${images}{display:block!important;box-sizing:border-box!important;width:48px!important;height:176px!important;min-width:48px!important;min-height:176px!important;max-width:48px!important;max-height:176px!important;border-radius:0!important;object-fit:contain!important}`;
  }

  const codexPageStyle = () => `
.itemx-codex-page-active{display:grid!important}
.itemx2-codex-card{position:relative;display:block;min-height:70px;border:1px solid #263247;border-radius:12px;background:linear-gradient(145deg,#121a28,#0b111b);overflow:hidden}.itemx2-codex-summary{position:relative;z-index:1;display:grid;grid-template-columns:48px minmax(0,1fr) minmax(72px,auto);gap:10px;align-items:center;min-height:70px;padding:10px;cursor:pointer}.itemx2-codex-glyph{display:grid;place-items:center;width:48px;height:48px;border:1px solid #40506b;border-radius:11px;background:#0b111c;color:#dbe8ff;font-size:1.2rem}.itemx2-codex-copy{display:grid;gap:3px;min-width:0}.itemx2-codex-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#edf2fb;font-size:.82rem}.itemx2-codex-copy small{color:#8494ad;font-size:.66rem}.itemx2-codex-tags{display:flex;flex-wrap:wrap;gap:4px}.itemx2-codex-tags i{padding:2px 5px;border:1px solid #344259;border-radius:999px;color:#aebbd0;font-size:.58rem;font-style:normal}.itemx2-skill-meta{display:grid;grid-template-columns:auto auto;gap:2px 5px;align-items:center;padding:6px 7px;border:1px solid #2e3a50;border-radius:9px;background:rgba(9,14,23,.82);font-size:.58rem}.itemx2-skill-meta small{color:#6f809a}.itemx2-skill-meta b{color:#dce6f5;font-size:.62rem;text-align:right}.itemx2-mastery{grid-column:2/-1;display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.itemx2-mastery i{height:5px;border-radius:6px;background:#202a3a}.itemx2-mastery i.on{background:linear-gradient(90deg,#66b8ff,#a985ff);box-shadow:0 0 8px rgba(102,184,255,.35)}.itemx2-bestiary-card.active{border-color:#70404a;box-shadow:inset 3px 0 #b55b68}.itemx2-bestiary-card img{width:48px;height:48px;border-radius:11px;object-fit:cover}
.itemx-codex-list{display:grid;gap:9px}.itemx-codex-list-button{width:100%;padding:0;border:0;color:inherit;text-align:left;font:inherit}.itemx2-codex-summary::after{content:'›';position:absolute;right:9px;bottom:5px;color:#71839f;font-size:.85rem;font-weight:900}.itemx-codex-page{position:relative;display:grid;gap:11px;min-height:100%;padding:2px 0 14px;animation:itemx-codex-page-in .22s cubic-bezier(.2,.78,.2,1) both}.itemx2-codex-page{display:none}.itemx2-codex-entry-choice:checked~.itemx2-codex-summary{display:none}.itemx2-codex-entry-choice:checked~.itemx2-codex-page{display:grid}.itemx2-root-skills:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-note,.itemx2-root-bestiary:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-note{display:none}.itemx2-root-skills:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-entry:not(:has(.itemx2-codex-entry-choice:checked)),.itemx2-root-bestiary:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-entry:not(:has(.itemx2-codex-entry-choice:checked)){display:none}.itemx-codex-back{justify-self:start;display:inline-flex;align-items:center;min-height:34px;padding:0 10px;border:1px solid #2d3a50;border-radius:9px;background:#101824;color:#c8d4e7;cursor:pointer;font:inherit;font-size:.7rem;font-weight:800}.itemx-codex-hero{position:relative;isolation:isolate;display:grid;place-items:center;min-height:218px;padding:24px 18px 20px;overflow:hidden;border:1px solid #33435d;border-radius:17px;background:radial-gradient(circle at 50% 45%,rgba(91,150,255,.19),transparent 31%),linear-gradient(145deg,#121b2b,#080d16 70%);box-shadow:inset 0 0 45px rgba(63,116,205,.1),0 12px 34px rgba(0,0,0,.32)}.itemx-codex-hero::before,.itemx-codex-hero::after{content:'';position:absolute;left:50%;top:44%;z-index:-1;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}.itemx-codex-hero::before{width:158px;height:158px;border:1px solid rgba(113,181,255,.34);background:repeating-conic-gradient(from 0deg,rgba(128,195,255,.28) 0 2deg,transparent 2deg 28deg);mask:radial-gradient(circle,transparent 53%,#000 54% 58%,transparent 59%);animation:itemx-codex-orbit 8s linear infinite}.itemx-codex-hero::after{width:112px;height:112px;border:1px solid rgba(173,139,255,.32);box-shadow:0 0 42px rgba(76,142,255,.2),inset 0 0 26px rgba(151,105,255,.12);animation:itemx-codex-orbit-reverse 5.5s linear infinite}.itemx-codex-hero-glyph{position:relative;z-index:2;display:grid;place-items:center;width:82px;height:82px;border:1px solid rgba(177,210,255,.55);border-radius:24px;background:radial-gradient(circle at 45% 38%,#263e62,#101827 68%);box-shadow:0 0 25px rgba(94,164,255,.28),inset 0 0 22px rgba(132,184,255,.16);color:#eff7ff;font-size:2.6rem;text-shadow:0 0 14px rgba(142,202,255,.8)}.itemx-codex-hero-copy{position:relative;z-index:2;display:grid;gap:5px;margin-top:18px;text-align:center}.itemx-codex-hero-copy small{color:#8fa4c4;font-size:.65rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.itemx-codex-hero-copy strong{color:#f3f7ff;font-size:1.08rem}.itemx-codex-hero-copy span{color:#9eb0ca;font-size:.68rem}.itemx-codex-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.itemx-codex-stat{display:grid;gap:4px;min-height:60px;padding:10px;border:1px solid #26344a;border-radius:11px;background:linear-gradient(145deg,#111a28,#0b111b)}.itemx-codex-stat small{color:#70819b;font-size:.59rem;font-weight:800}.itemx-codex-stat strong{color:#e8effa;font-size:.72rem;overflow-wrap:anywhere}.itemx-codex-section{display:grid;gap:7px;padding:12px;border:1px solid #243147;border-radius:12px;background:#0c131e;color:#becadd;font-size:.7rem;line-height:1.58}.itemx-codex-section h4{margin:0;color:#d9e6f8;font-size:.67rem;letter-spacing:.08em}.itemx-codex-section p{margin:0;white-space:pre-wrap}.itemx-codex-chip-row{display:flex;flex-wrap:wrap;gap:5px}.itemx-codex-chip-row i{padding:4px 7px;border:1px solid #34445e;border-radius:999px;background:#111a28;color:#b8c7dd;font-size:.61rem;font-style:normal}.itemx-codex-mastery{display:grid;grid-template-columns:repeat(10,1fr);gap:4px}.itemx-codex-mastery i{height:7px;border-radius:999px;background:#202b3c}.itemx-codex-mastery i.on{background:linear-gradient(90deg,#5cbcff,#a978ff);box-shadow:0 0 9px rgba(92,188,255,.42)}.itemx-monster-hero{border-color:#623743;background:radial-gradient(circle at 50% 40%,rgba(222,62,88,.2),transparent 34%),repeating-linear-gradient(0deg,transparent 0 22px,rgba(179,63,79,.035) 23px),linear-gradient(145deg,#211018,#090d14 72%);box-shadow:inset 0 0 54px rgba(190,39,64,.12),0 12px 34px rgba(0,0,0,.38)}.itemx-monster-hero::before{width:174px;height:174px;border-color:rgba(255,99,123,.36);background:repeating-conic-gradient(from 0deg,rgba(255,86,112,.32) 0 1.5deg,transparent 1.5deg 22deg);animation-duration:11s}.itemx-monster-hero::after{width:100%;height:2px;border:0;border-radius:0;background:linear-gradient(90deg,transparent,#ff667e,transparent);box-shadow:0 0 18px rgba(255,62,92,.7);animation:itemx-codex-scan 3.2s ease-in-out infinite}.itemx-monster-portrait{position:relative;z-index:2;width:112px;height:112px;border:1px solid rgba(255,124,143,.58);border-radius:18px;object-fit:cover;box-shadow:0 0 0 5px rgba(93,24,35,.35),0 0 32px rgba(255,65,94,.3);filter:saturate(.86) contrast(1.06)}.itemx-monster-hero .itemx-codex-hero-glyph{border-color:rgba(255,124,143,.54);background:radial-gradient(circle at 45% 38%,#5a2632,#1b1018 70%);box-shadow:0 0 28px rgba(255,60,91,.3),inset 0 0 22px rgba(255,111,131,.12)}.itemx-threat-banner{position:absolute;left:10px;top:10px;z-index:3;padding:5px 8px;border:1px solid rgba(255,109,130,.48);border-radius:999px;background:rgba(41,10,17,.82);color:#ff9aab;font-size:.58rem;font-weight:900;letter-spacing:.12em}@keyframes itemx-codex-page-in{from{opacity:0;transform:translate3d(12px,0,0)}to{opacity:1;transform:none}}@keyframes itemx-codex-orbit{to{transform:translate(-50%,-50%) rotate(360deg)}}@keyframes itemx-codex-orbit-reverse{to{transform:translate(-50%,-50%) rotate(-360deg)}}@keyframes itemx-codex-scan{0%,100%{top:18%;opacity:.2}50%{top:78%;opacity:1}}@media(prefers-reduced-motion:reduce){.itemx-codex-page,.itemx-codex-hero::before,.itemx-codex-hero::after{animation:none!important}}
`;

  const rootDrawerStyle = () => `
.itemx2-root-drawer,.itemx2-root-drawer *{box-sizing:border-box}
.itemx2-root-drawer{position:fixed;inset:0;z-index:49;pointer-events:none;font-family:Inter,Pretendard,"Noto Sans KR",sans-serif;color:#e6ebf4}
.itemx2-root-control{position:fixed!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
.itemx2-native-badge{position:fixed;z-index:50;display:block;width:48px;height:176px;padding:0;overflow:visible;pointer-events:auto;cursor:pointer;touch-action:manipulation;background:transparent;border:0;box-shadow:none}
.itemx2-native-badge img{display:block;width:48px;height:176px;max-width:none;border:0;border-radius:0;pointer-events:none}
.itemx2-update-indicator{position:absolute;right:-2px;top:5px;z-index:2;display:grid;place-items:center;width:17px;height:17px;border:1px solid rgba(174,255,204,.8);border-radius:999px;background:#16834b;box-shadow:0 0 0 2px rgba(7,12,19,.88),0 3px 10px rgba(25,196,105,.38);color:#effff5;font-size:11px;font-weight:950;line-height:1;pointer-events:none}
.itemx2-update-label{display:inline-flex;margin-left:6px;padding:2px 5px;border:1px solid rgba(112,225,155,.46);border-radius:999px;background:rgba(20,107,61,.34);color:#94e9b3;font-size:8px;font-weight:950;letter-spacing:.08em;vertical-align:1px}
.itemx2-aux-status{position:fixed;z-index:52;display:none;align-items:center;gap:7px;min-height:34px;padding:0 11px;border:1px solid rgba(212,175,110,.48);border-radius:999px;background:rgba(9,13,23,.94);box-shadow:0 8px 24px rgba(0,0,0,.48),0 0 14px rgba(212,175,110,.14);color:#f0dfb9;font-size:11px;font-weight:800;white-space:nowrap;pointer-events:none}.itemx2-aux-status-on{display:flex}.itemx2-aux-status i{width:12px;height:12px;border:2px solid rgba(240,223,185,.24);border-top-color:#f0c979;border-radius:50%;animation:itemx2-aux-spin .8s linear infinite}
.itemx2-root-drawer.itemx2-pos-lb .itemx2-aux-status{left:58px;right:auto;top:auto;bottom:calc(5.2rem + 70px + env(safe-area-inset-bottom,0px));transform:none}.itemx2-root-drawer.itemx2-pos-lm .itemx2-aux-status{left:58px;right:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-lt .itemx2-aux-status{left:58px;right:auto;top:calc(4.5rem + 70px + env(safe-area-inset-top,0px));bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-rb .itemx2-aux-status{right:58px;left:auto;top:auto;bottom:calc(5.2rem + 70px + env(safe-area-inset-bottom,0px));transform:none}.itemx2-root-drawer.itemx2-pos-rm .itemx2-aux-status{right:58px;left:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-rt .itemx2-aux-status{right:58px;left:auto;top:calc(4.5rem + 70px + env(safe-area-inset-top,0px));bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-lb .itemx2-native-badge{left:4px;right:auto;top:auto;bottom:calc(5.2rem + env(safe-area-inset-bottom,0px));transform:none}.itemx2-root-drawer.itemx2-pos-lm .itemx2-native-badge{left:4px;right:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-lt .itemx2-native-badge{left:4px;right:auto;top:calc(4.5rem + env(safe-area-inset-top,0px));bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-rb .itemx2-native-badge{right:4px;left:auto;top:auto;bottom:calc(5.2rem + env(safe-area-inset-bottom,0px));transform:none}.itemx2-root-drawer.itemx2-pos-rm .itemx2-native-badge{right:4px;left:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-rt .itemx2-native-badge{right:4px;left:auto;top:calc(4.5rem + env(safe-area-inset-top,0px));bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-lb .itemx2-root-panel{left:60px;right:auto;top:auto;bottom:12px;transform:none}.itemx2-root-drawer.itemx2-pos-lm .itemx2-root-panel{left:60px;right:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-lt .itemx2-root-panel{left:60px;right:auto;top:12px;bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-rb .itemx2-root-panel{right:60px;left:auto;top:auto;bottom:12px;transform:none}.itemx2-root-drawer.itemx2-pos-rm .itemx2-root-panel{right:60px;left:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-rt .itemx2-root-panel{right:60px;left:auto;top:12px;bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-is-open .itemx2-native-badge{display:none}
.itemx2-root-drawer.itemx2-host-settings .itemx2-native-badge,.itemx2-root-drawer.itemx2-host-settings .itemx2-aux-status,.itemx2-root-drawer.itemx2-host-settings .itemx2-root-layer,.itemx2-root-drawer.itemx2-host-settings .itemx2-boot-card{display:none!important}
.itemx2-boot-card{position:fixed;left:50%;top:50%;z-index:53;display:flex;align-items:center;gap:11px;min-width:220px;max-width:calc(100vw - 32px);padding:14px 16px;border:1px solid rgba(212,175,110,.52);border-radius:14px;background:rgba(9,13,23,.96);box-shadow:0 18px 50px rgba(0,0,0,.58),0 0 22px rgba(212,175,110,.12);color:#f0dfb9;transform:translate(-50%,-50%);font-size:12px;font-weight:800}.itemx2-boot-card i{width:18px;height:18px;flex:0 0 auto;border:2px solid rgba(240,223,185,.22);border-top-color:#f0c979;border-radius:50%;animation:itemx2-aux-spin .8s linear infinite}.itemx2-boot-card span{display:grid;gap:2px}.itemx2-boot-card small{color:#8190a7;font-size:10px;font-weight:600}
.itemx2-feedback{position:fixed;left:50%;top:calc(14px + env(safe-area-inset-top,0px));z-index:54;max-width:calc(100vw - 32px);padding:9px 13px;border:1px solid #354157;border-radius:999px;background:rgba(9,13,23,.96);box-shadow:0 10px 30px rgba(0,0,0,.5);color:#dbe4f2;font-size:11px;font-weight:800;line-height:1.35;text-align:center;opacity:0;visibility:hidden;transform:translate(-50%,-7px);transition:opacity .14s ease,transform .14s ease,visibility 0s .14s;pointer-events:none}.itemx2-feedback-on{opacity:1;visibility:visible;transform:translate(-50%,0);transition:opacity .14s ease,transform .14s ease}.itemx2-feedback-success{border-color:#37634d;color:#a9e6c2}.itemx2-feedback-error{border-color:#61343a;color:#ffadb5}.itemx2-feedback-working{border-color:#6a5530;color:#e8c987}
.itemx2-root-layer{position:fixed;inset:0;pointer-events:none;visibility:visible;opacity:1;transition:opacity .16s ease,visibility 0s}
.itemx2-root-panel{position:fixed;display:flex;flex-direction:column;width:min(420px,calc(100vw - 66px));height:min(700px,72dvh);max-height:calc(100dvh - 24px);margin:0;overflow:hidden;pointer-events:auto;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.58)}
.itemx2-root-pos-lb{left:60px;bottom:12px}.itemx2-root-pos-lm{left:60px;top:50%;transform:translateY(-50%)}.itemx2-root-pos-lt{left:60px;top:12px}
.itemx2-root-pos-rb{right:60px;bottom:12px}.itemx2-root-pos-rm{right:60px;top:50%;transform:translateY(-50%)}.itemx2-root-pos-rt{right:60px;top:12px}
.itemx2-root-drawer.itemx2-is-open .itemx2-root-panel{animation:itemx2-root-in .19s cubic-bezier(.2,.78,.2,1) both}.itemx2-root-drawer:not(.itemx2-is-open) .itemx2-root-layer{opacity:0;visibility:hidden;transition:opacity .14s ease,visibility 0s .14s}
.itemx2-root-drawer:not(.itemx2-is-open) .itemx2-root-panel{pointer-events:none;animation:itemx2-root-out .14s ease both}
.itemx2-root-drawer:not(.itemx2-is-open) .itemx-card *{animation-play-state:paused!important}
.itemx2-root-close,.itemx2-root-back{cursor:pointer}.itemx2-root-empty{padding:2rem;text-align:center;color:#77839c}
.itemx-main-tabs{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #171d2b}.itemx-main-tab{min-height:44px;display:grid;place-items:center;border-bottom:2px solid transparent;background:#0d121c;color:#77839c;cursor:pointer;font-size:.72rem;font-weight:800}
.itemx2-root-skills,.itemx2-root-bestiary{display:none;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:12px;background:#090e16}.itemx2-tab-skills:checked~.itemx2-root-layer .itemx2-root-inventory,.itemx2-tab-skills:checked~.itemx2-root-layer .itemx2-root-settings,.itemx2-tab-bestiary:checked~.itemx2-root-layer .itemx2-root-inventory,.itemx2-tab-bestiary:checked~.itemx2-root-layer .itemx2-root-settings{display:none}.itemx2-tab-skills:checked~.itemx2-root-layer .itemx2-root-skills,.itemx2-tab-bestiary:checked~.itemx2-root-layer .itemx2-root-bestiary{display:grid;align-content:start;gap:9px}.itemx2-tab-inventory:checked~.itemx2-root-layer label[for="itemx2-tab-inventory"],.itemx2-tab-skills:checked~.itemx2-root-layer label[for="itemx2-tab-skills"],.itemx2-tab-bestiary:checked~.itemx2-root-layer label[for="itemx2-tab-bestiary"],.itemx2-tab-settings:checked~.itemx2-root-layer label[for="itemx2-tab-settings"]{border-bottom-color:#d4af6e;color:#f3dcaa;background:#121925}
.itemx2-codex-card{position:relative;display:block;min-height:70px;border:1px solid #263247;border-radius:12px;background:linear-gradient(145deg,#121a28,#0b111b);overflow:hidden}.itemx2-codex-summary{position:relative;z-index:1;display:grid;grid-template-columns:48px minmax(0,1fr) minmax(72px,auto);gap:10px;align-items:center;min-height:70px;padding:10px;cursor:pointer;list-style:none}.itemx2-codex-summary::-webkit-details-marker{display:none}.itemx2-codex-summary::after{content:'＋';position:absolute;right:8px;bottom:5px;color:#66758d;font-size:.7rem}.itemx2-codex-card[open]>.itemx2-codex-summary::after{content:'－';color:#d4af6e}.itemx2-codex-glyph{display:grid;place-items:center;width:48px;height:48px;border:1px solid #40506b;border-radius:11px;background:#0b111c;color:#dbe8ff;font-size:1.45rem}.itemx2-codex-copy{display:grid;gap:3px;min-width:0}.itemx2-codex-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#edf2fb;font-size:.82rem}.itemx2-codex-copy small{color:#8494ad;font-size:.66rem}.itemx2-codex-tags{display:flex;flex-wrap:wrap;gap:4px}.itemx2-codex-tags i{padding:2px 5px;border:1px solid #344259;border-radius:999px;color:#aebbd0;font-size:.58rem;font-style:normal}.itemx2-codex-detail{position:relative;z-index:1;display:grid;gap:8px;padding:10px 12px 12px;border-top:1px solid #202b3c;background:rgba(7,11,18,.72);color:#b8c4d7;font-size:.68rem;line-height:1.55}.itemx2-codex-detail p{margin:0;color:#c8d2e1;white-space:pre-wrap}.itemx2-codex-detail-row{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px}.itemx2-codex-detail-row b{color:#74849d;font-size:.62rem}.itemx2-codex-detail-row span{overflow-wrap:anywhere}.itemx2-skill-meta{position:relative;z-index:1;display:grid;grid-template-columns:auto auto;gap:2px 5px;align-items:center;padding:6px 7px;border:1px solid #2e3a50;border-radius:9px;background:rgba(9,14,23,.82);font-size:.58rem}.itemx2-skill-meta small{color:#6f809a}.itemx2-skill-meta b{color:#dce6f5;font-size:.62rem;text-align:right}.itemx2-mastery{grid-column:2/-1;display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.itemx2-mastery i{height:5px;border-radius:6px;background:#202a3a;overflow:hidden}.itemx2-mastery i.on{background:linear-gradient(90deg,#66b8ff,#a985ff);box-shadow:0 0 8px rgba(102,184,255,.35)}.itemx2-skill-card::after{content:'';position:absolute;right:-18px;top:-25px;width:82px;height:82px;border:1px solid rgba(114,181,255,.18);border-radius:50%;box-shadow:0 0 20px rgba(90,147,255,.12);animation:itemx2-skill-orbit 5s linear infinite}.itemx2-bestiary-card.active{border-color:#70404a;box-shadow:inset 3px 0 #b55b68}.itemx2-bestiary-card img{width:48px;height:48px;border-radius:11px;object-fit:cover}.itemx2-codex-empty{padding:34px 16px;text-align:center;color:#6f7e96;font-size:.75rem}.itemx2-codex-note{padding:9px 10px;border:1px solid #1c2635;border-radius:9px;background:#0c121c;color:#8594aa;font-size:.66rem;line-height:1.45}@keyframes itemx2-skill-orbit{to{transform:rotate(360deg)}}
.itemx-tile,.itemx2-codex-card{content-visibility:auto;contain:layout paint style}.itemx-tile{contain-intrinsic-size:92px}.itemx2-codex-card{contain-intrinsic-size:78px}
.itemx2-root-inventory{display:flex;flex:1;min-height:0;flex-direction:column;overflow:hidden}.itemx2-root-inventory>.itemx-body{flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding-bottom:calc(.95em + env(safe-area-inset-bottom,0px))}
.itemx2-root-inventory>.itemx-pf{display:flex;align-items:center;justify-content:space-between;gap:8px}.itemx2-root-pager{display:inline-flex;align-items:center;gap:7px}.itemx2-root-pager button{width:30px;height:28px;border:1px solid #2d394c;border-radius:7px;background:#151d2a;color:#d9e4f3;font:inherit;font-weight:900}.itemx2-root-pager button:disabled{opacity:.3}.itemx2-root-pager b{min-width:42px;color:#9eabc0;font-size:.65rem;text-align:center}
.itemx2-root-item{display:block}.itemx2-root-tile-label{display:block;cursor:pointer}.itemx2-root-tile-label .itemx-tile{width:100%;pointer-events:none}
.itemx2-root-detail{display:none}.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-filters,.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-tools,.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx-pf{display:none}
.itemx2-root-settings{display:none;flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px))}.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-inventory,.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-skills,.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-bestiary{display:none}.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-settings{display:grid;gap:10px}
.itemx2-root-tab-body{display:flex;flex:1;min-height:0;flex-direction:column;overflow:hidden}.itemx2-root-tab-body>.itemx2-root-skills,.itemx2-root-tab-body>.itemx2-root-bestiary{display:grid;align-content:start;gap:9px}.itemx2-root-tab-body>.itemx2-root-settings{display:grid;gap:10px}.itemx-main-tab-on{border-bottom-color:#d4af6e!important;color:#f3dcaa!important;background:#121925!important}.itemx2-tab-loading{display:grid;flex:1;min-height:0;place-content:center;justify-items:center;gap:10px;padding:24px;color:#b7c3d6;text-align:center}.itemx2-tab-loading i{width:28px;height:28px;border:2px solid rgba(212,175,110,.2);border-top-color:#d4af6e;border-radius:50%;animation:itemx2-tab-spin .7s linear infinite}.itemx2-tab-loading strong{color:#f0dfb8;font-size:.78rem}.itemx2-tab-loading small{color:#718097;font-size:.66rem}@keyframes itemx2-tab-spin{to{transform:rotate(360deg)}}
.itemx2-position-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.itemx2-position-choice{display:grid;place-items:center;min-height:38px;border:1px solid #2b3547;border-radius:9px;background:#151d2a;color:#9aabc4;cursor:pointer}.itemx2-pos-lb:checked~.itemx2-root-layer label[for="itemx2-pos-lb"],.itemx2-pos-lm:checked~.itemx2-root-layer label[for="itemx2-pos-lm"],.itemx2-pos-lt:checked~.itemx2-root-layer label[for="itemx2-pos-lt"],.itemx2-pos-rb:checked~.itemx2-root-layer label[for="itemx2-pos-rb"],.itemx2-pos-rm:checked~.itemx2-root-layer label[for="itemx2-pos-rm"],.itemx2-pos-rt:checked~.itemx2-root-layer label[for="itemx2-pos-rt"]{border-color:#d4af6e;background:#292316;color:#f3dcaa}
.itemx2-position-on{border-color:#d4af6e;background:#292316;color:#f3dcaa}
.itemx2-root-setting-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;border:1px solid #1c2331;border-radius:12px;background:#0d121c}.itemx2-root-setting-card span{display:grid;gap:3px}.itemx2-root-setting-card small{color:#77839c;line-height:1.4}.itemx2-root-setting-button{min-height:36px;padding:0 11px;border:1px solid #2b3547;border-radius:9px;background:#151d2a;color:#cbd7e9;cursor:pointer}
.itemx2-status-row{display:flex!important;flex-direction:row!important;flex-wrap:wrap;gap:5px!important;margin-top:3px}.itemx2-status-chip{display:inline-flex!important;padding:3px 7px;border:1px solid #354157;border-radius:999px;background:#131a26;color:#93a2ba;font-size:.66rem;font-weight:800;font-style:normal}.itemx2-status-chip-on{border-color:#37634d;color:#9cddb7;background:#102019}.itemx2-status-chip-warn{border-color:#6a5530;color:#e8c987;background:#241d10}.itemx2-status-chip-off{border-color:#61343a;color:#efa8af;background:#251216}.itemx2-root-setting-button-primary{border-color:#6e5a32;background:#2a2316;color:#f0d79d}.itemx2-setting-on{border-color:#4e8968!important;background:#12241a!important;color:#a9e6c2!important}.itemx2-root-setting-button:disabled,.itemx2-root-setting-button-busy{opacity:.58;cursor:default;pointer-events:none}.itemx2-aux-status-done i,.itemx2-aux-status-failed i{border:0!important;animation:none!important}.itemx2-aux-status-done i::before{content:'✓';color:#9cddb7;font-style:normal;font-weight:900}.itemx2-aux-status-failed i::before{content:'!';color:#ffadb5;font-style:normal;font-weight:900}
.itemx2-manager-fold{border:1px solid #283247;border-radius:12px;background:#0b1019;overflow:hidden}.itemx2-manager-fold summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px;cursor:pointer;color:#f0d79d;font-weight:800;list-style:none}.itemx2-manager-fold summary::-webkit-details-marker{display:none}.itemx2-manager-fold summary::after{content:'＋';color:#8291aa}.itemx2-manager-fold[open] summary::after{content:'－'}.itemx2-manager-body{display:grid;gap:10px;padding:0 12px 12px}.itemx2-manager-label{display:grid;gap:5px;color:#8592a8;font-size:.72rem}.itemx2-manager-editor{min-height:58px;padding:9px;border:1px solid #293448;border-radius:9px;background:#121925;color:#e3e9f3;white-space:pre-wrap;overflow-wrap:anywhere;outline:none}.itemx2-manager-editor:focus{border-color:#637ba3}.itemx2-manager-list{display:grid;gap:7px}.itemx2-manager-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px;border:1px solid #1d2737;border-radius:9px;background:#101722}.itemx2-manager-name{display:grid;gap:2px;min-width:0}.itemx2-manager-name strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e9eef7;font-size:.78rem}.itemx2-manager-name small{color:#6f7e96;font-size:.67rem}.itemx2-manager-actions{display:flex;gap:5px}.itemx2-manager-actions button{min-height:31px;padding:0 8px;border:1px solid #344159;border-radius:7px;background:#172131;color:#cbd7e9;cursor:pointer}.itemx2-manager-actions .itemx2-manager-remove{border-color:#65333a;color:#ffadb5}.itemx2-manager-create{display:grid;gap:7px;padding-top:3px;border-top:1px solid #1d2737}
.itemx2-domain-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.itemx2-domain-card{display:grid;gap:5px;padding:10px;border:1px solid #273247;border-radius:10px;background:#101722;color:#dce5f2;text-align:left}.itemx2-domain-card small{color:#718199;font-size:.62rem}.itemx2-debug-fold{border-color:#334056}.itemx2-debug-body{display:grid;gap:8px;padding:0 12px 12px}.itemx2-debug-grid{display:grid;grid-template-columns:72px minmax(0,1fr);gap:5px 8px;font-size:.64rem}.itemx2-debug-grid b{color:#718199}.itemx2-debug-grid span{color:#c4cfdf;overflow-wrap:anywhere}.itemx2-debug-log{display:grid;gap:4px;max-height:180px;overflow:auto;padding:8px;border:1px solid #202b3d;border-radius:8px;background:#080d15;color:#91a2ba;font:10px/1.45 monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-item{display:none}.itemx2-root-panel .itemx2-root-item:has(.itemx2-root-detail-choice:checked){display:block}.itemx2-root-detail-choice:checked~.itemx2-root-tile-label{display:none}.itemx2-root-detail-choice:checked~.itemx2-root-detail{display:block}
.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx-grid{grid-template-columns:minmax(0,1fr)}.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-item:has(.itemx2-root-detail-choice:checked){grid-column:1/-1;width:100%;min-width:0}.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx-detail{width:100%}
.itemx2-root-filter-owned:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-owned),.itemx2-root-filter-equipped:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-equipped),.itemx2-root-filter-observed:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-observed),.itemx2-root-filter-removed:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-removed){display:none}
.itemx2-root-filter-all:checked~.itemx2-root-layer label[for="itemx2-filter-all"],.itemx2-root-filter-owned:checked~.itemx2-root-layer label[for="itemx2-filter-owned"],.itemx2-root-filter-equipped:checked~.itemx2-root-layer label[for="itemx2-filter-equipped"],.itemx2-root-filter-observed:checked~.itemx2-root-layer label[for="itemx2-filter-observed"],.itemx2-root-filter-removed:checked~.itemx2-root-layer label[for="itemx2-filter-removed"]{border-bottom-color:#d4af6e;color:#f2ead9;font-weight:700}
@keyframes itemx2-root-in{from{opacity:0;translate:0 7px;scale:.982}to{opacity:1;translate:0;scale:1}}@keyframes itemx2-root-out{from{opacity:1}to{opacity:0;translate:0 5px;scale:.988}}@keyframes itemx2-aux-spin{to{transform:rotate(360deg)}}
@media(max-width:520px){.itemx2-root-panel{width:calc(100vw - 68px);height:min(660px,72dvh)}.itemx2-root-pos-lb,.itemx2-root-pos-lm,.itemx2-root-pos-lt{left:56px;right:auto;top:auto;bottom:8px;transform:none}.itemx2-root-pos-rb,.itemx2-root-pos-rm,.itemx2-root-pos-rt{right:56px;left:auto;top:auto;bottom:8px;transform:none}}
@media(prefers-reduced-motion:reduce){.itemx2-root-layer,.itemx2-root-panel,.itemx2-aux-status i{animation:none!important;transition:none!important}}
${codexPageStyle()}
`;
  function prefixRisuClasses(css) {
    return String(css || '').replace(/\.([a-zA-Z][\w-]*)/g, (_, name) => name.startsWith('x-risu-') ? `.${name}` : `.x-risu-${name}`);
  }
  const bodyScrollStyle = `.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-fx,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-cond{visibility:hidden!important}.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-fx *,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-cond *{animation-play-state:paused!important}`;
  const mainStyleText = () => `${ITEMX_MAIN_STYLE}\n${prefixRisuClasses(`${ITEMX_CHAT_STYLE}\n${rootDrawerStyle()}`)}\n${bodyScrollStyle}\n${badgeStyle()}`;

  function enqueue(key, work) {
    const prev = queues.get(key) || Promise.resolve();
    const next = prev.catch(() => {}).then(work).finally(() => { if (queues.get(key) === next) queues.delete(key); });
    queues.set(key, next); return next;
  }

  function refreshLatest(chat) {
    loadMessageEventLedger(chat);
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    let latest = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      const text = messageData(messages[i]);
      if (messageEvents(chat, text, 'item').length || messageEvents(chat, text, 'codex').length) { latest = text; break; }
    }
    runtime.latestOutput = latest;
    const persisted = markerCodes(latest);
    if (runtime.pendingMarkersAt && Date.now() - runtime.pendingMarkersAt < 12000) {
      for (const marker of runtime.pendingMarkers) persisted.add(marker);
    } else {
      runtime.pendingMarkers.clear();
      runtime.pendingMarkersAt = 0;
    }
    runtime.latestMarkers = persisted;
  }

  function manualLedger(chat) {
    try {
      const raw = chat?.scriptstate?.[ITEMX_MANUAL_KEY];
      const rows = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(rows) ? rows.filter((row) => row && Number.isInteger(row.afterIndex) && row.event?.kind).slice(-256) : [];
    } catch { return []; }
  }

  function messageEventLedger(chat) {
    try {
      const raw = chat?.scriptstate?.[ITEMX_MESSAGE_EVENT_KEY];
      const rows = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(rows) ? rows.filter((row) => row && /^[A-Za-z0-9_-]{1,80}$/.test(row.ref || '') && ['item', 'codex'].includes(row.domain) && row.payload?.event).slice(-512) : [];
    } catch { return []; }
  }

  function loadMessageEventLedger(chat) {
    runtime.eventPayloads = new Map(messageEventLedger(chat).map((row) => [`${row.domain}:${row.ref}`, row.payload]));
  }

  function embeddedViewCode(payload, domain) {
    const view = payload?.view;
    if (!view) return '';
    const envelope = domain === 'codex'
      ? { v: ITEMXCodex.VERSION, d: payload.event?.domain || '', e: { i: view.id, n: view.name, g: view.glyph } }
      : { v: ITEMXCore.VERSION, i: {
        i: view.id, n: view.name, t: view.itemType, e: view.emoji, r: view.rarity, d: view.displayRarity,
        p: view.power, q: view.required, u: view.durability, c: view.cost, o: view.possession, l: view.location,
        k: view.count, s: view.slot, h: view.theme, a: view.affinity, b: view.affinity2, x: view.condition,
        f: (view.effects || []).map((row) => [row.name, row.desc]), g: (view.augments || []).map((row) => [row.name, row.desc]), z: view.trivia
      } };
    const marker = ITEMXCore.marker(envelope);
    return marker.startsWith('<!--ITEMX2:') && marker.endsWith('-->') ? marker.slice('<!--ITEMX2:'.length, -3) : '';
  }

  function compactRefMarker(prefix, ref, payload, domain) {
    const code = embeddedViewCode(payload, domain);
    return `<!--${prefix}@${ref}${code ? `:${code}` : ''}-->`;
  }

  function inlineViewPayload(code, domain) {
    if (!code) return null;
    const payload = ITEMXCore.decodePayload(code);
    if (payload?.view) return domain === 'codex' ? { v: payload.v, event: { domain: payload.domain || '' }, view: payload.view } : { v: payload.v, view: payload.view };
    if (domain === 'codex' && payload?.e) return { v: payload.v, event: { domain: payload.d || '' }, view: { id: payload.e.i, name: payload.e.n, glyph: payload.e.g } };
    if (domain !== 'item' || !payload?.i) return null;
    const item = payload.i;
    return { v: payload.v, view: {
      id: item.i, name: item.n, itemType: item.t, emoji: item.e, rarity: item.r, displayRarity: item.d,
      power: item.p, required: item.q, durability: item.u, cost: item.c, possession: item.o, location: item.l,
      count: item.k, slot: item.s, theme: item.h, affinity: item.a, affinity2: item.b, condition: item.x,
      effects: (item.f || []).map((row) => ({ name: row[0], desc: row[1] })), augments: (item.g || []).map((row) => ({ name: row[0], desc: row[1] })), trivia: item.z
    } };
  }

  function embedStoredRefViews(chat) {
    const rows = messageEventLedger(chat);
    if (!rows.length) return { chat, changed: false };
    const byKey = new Map(rows.map((row) => [`${row.domain}:${row.ref}`, row.payload]));
    let next = null, changed = false;
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    for (let index = 0; index < messages.length; index += 1) {
      const original = messageData(messages[index]);
      let source = original.replace(ITEMX_REF_RE, (raw, ref, inline) => inline ? raw : compactRefMarker('ITEMX2', ref, byKey.get(`item:${ref}`), 'item'));
      source = source.replace(ITEMX_CODEX_REF_RE, (raw, ref, inline) => inline ? raw : compactRefMarker('CODEX2', ref, byKey.get(`codex:${ref}`), 'codex'));
      if (source === original) continue;
      if (!next) next = ITEMXCore.clone(chat);
      const message = next.message[index];
      if (typeof message.data === 'string') message.data = source;
      else if (typeof message.content === 'string') message.content = source;
      changed = true;
    }
    return { chat: next || chat, changed };
  }

  function messageEvents(chat, text, domain) {
    const rows = messageEventLedger(chat), byRef = new Map(rows.filter((row) => row.domain === domain).map((row) => [row.ref, row.payload]));
    const found = [];
    const fullRe = domain === 'item' ? ITEMXCore.MARKER_RE : ITEMXCodex.MARKER_RE;
    const refRe = domain === 'item' ? ITEMX_REF_RE : ITEMX_CODEX_REF_RE;
    String(text || '').replace(fullRe, (raw, code, index) => {
      const payload = domain === 'item' ? ITEMXCore.decodePayload(code) : ITEMXCodex.decodePayload(code);
      if (payload?.event) found.push({ index, event: payload.event });
      return raw;
    });
    String(text || '').replace(refRe, (raw, ref, inline, index) => {
      const payload = byRef.get(ref);
      if (payload?.event) found.push({ index, event: payload.event });
      return raw;
    });
    return found.sort((a, b) => a.index - b.index).map((row) => row.event);
  }

  function rebuildCodexWithLedger(chat) {
    const state = ITEMXCodex.snapshot(); let transport = '';
    for (const message of chat?.message || []) for (const event of messageEvents(chat, messageData(message), 'codex')) {
      ITEMXCodex.applyEvent(state, event); transport += JSON.stringify(event);
    }
    state.fingerprint = ITEMXCore.fnv1a(transport); state.updatedAt = Date.now();
    return state;
  }

  function compactMessageTransports(chat, index) {
    const next = ITEMXCore.clone(chat), message = next.message?.[index];
    if (!message) return { chat: next, changed: false };
    let source = messageData(message), ordinal = 0, changed = false;
    const rows = messageEventLedger(next), byKey = new Map(rows.map((row) => [`${row.domain}:${row.ref}`, row]));
    const replace = (domain, regex, decode, prefix) => {
      source = source.replace(regex, (raw, code) => {
        const payload = decode(code);
        if (!payload?.event) return '';
        const ref = `${domain[0]}${index.toString(36)}_${(ordinal++).toString(36)}_${ITEMXCore.fnv1a(code)}`;
        byKey.set(`${domain}:${ref}`, { ref, domain, payload: ITEMXCore.clone(payload) });
        changed = true;
        return compactRefMarker(prefix, ref, payload, domain);
      });
    };
    replace('item', ITEMXCore.MARKER_RE, ITEMXCore.decodePayload, 'ITEMX2');
    replace('codex', ITEMXCodex.MARKER_RE, ITEMXCodex.decodePayload, 'CODEX2');
    if (!changed) return { chat: next, changed: false };
    if (typeof message.data === 'string') message.data = source;
    else if (typeof message.content === 'string') message.content = source;
    const used = new Set();
    for (const one of next.message || []) {
      const text = messageData(one);
      text.replace(ITEMX_REF_RE, (_, ref) => { used.add(`item:${ref}`); return ''; });
      text.replace(ITEMX_CODEX_REF_RE, (_, ref) => { used.add(`codex:${ref}`); return ''; });
    }
    const kept = [...byKey.entries()].filter(([key]) => used.has(key)).map(([, row]) => row).slice(-512);
    next.scriptstate = { ...(next.scriptstate || {}), [ITEMX_MESSAGE_EVENT_KEY]: JSON.stringify(kept) };
    return { chat: next, changed: true };
  }

  function rebuildWithManual(chat) {
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    const ledger = manualLedger(chat), reg = ITEMXCore.newRegistry();
    let transport = '';
    const apply = (event) => { ITEMXCore.applyEvent(reg, event); transport += ITEMXCore.marker({ v: ITEMXCore.VERSION, event }); };
    for (let index = 0; index < messages.length; index += 1) {
      for (const event of messageEvents(chat, messageData(messages[index]), 'item')) apply(event);
      for (const row of ledger) if (row.afterIndex === index) apply(row.event);
    }
    for (const row of ledger) if (row.afterIndex < 0 || row.afterIndex >= messages.length) apply(row.event);
    return { schema: ITEMXCore.VERSION, rev: 2, fingerprint: ITEMXCore.fnv1a(transport), updatedAt: Date.now(), registry: reg };
  }

  async function rebuildCurrent({ upgradeDisplayRefs = false } = {}) {
    const ctx = await context();
    if (!ctx) return null;
    return enqueue(ctx.key, async () => {
      let latestChat = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
      if (!latestChat) return null;
      if (upgradeDisplayRefs && !latestChat.isStreaming && !(latestChat.message || []).some((message) => message?.isStreaming)) {
        const embedded = embedStoredRefViews(latestChat);
        if (embedded.changed && runtime.activeContextKey === ctx.key) {
          await Risuai.setChatToIndex(ctx.characterIndex, ctx.chatIndex, embedded.chat);
          latestChat = embedded.chat;
          debugRecord('display refs', 'embedded self-contained views');
        }
      }
      const snapshot = rebuildWithManual(latestChat);
      const codexSnapshot = rebuildCodexWithLedger(latestChat);
      refreshLatest(latestChat);
      // Normal rebuilds are deliberately read-only. Writing an entire chat
      // snapshot here can race another module's output hook and restore an
      // older assistant message over its freshly appended display markers.
      runtime.status = `정상 · 아이템 ${snapshot.registry.order.length} · 스킬 ${codexSnapshot.skills.order.length} · 도감 ${codexSnapshot.monsters.order.length}`;
      const loaded = { ...ctx, chat: latestChat, snapshot, codexSnapshot };
      runtime.cachedLoaded = loaded;
      runtime.cachedGeneration = runtime.generation;
      return loaded;
    });
  }

  async function cachedOrRebuildCurrent() {
    const [characterIndex, chatIndex] = await Promise.all([Risuai.getCurrentCharacterIndex(), Risuai.getCurrentChatIndex()]);
    const cached = runtime.cachedLoaded;
    if (cached && cached.characterIndex === characterIndex && cached.chatIndex === chatIndex && runtime.cachedGeneration === runtime.generation) return cached;
    return rebuildCurrent();
  }

  async function commitManualEvents(loaded, events, label) {
    if (!loaded || !Array.isArray(events) || !events.length) throw new Error('No manual events to commit');
    const latest = await Risuai.getChatFromIndex(loaded.characterIndex, loaded.chatIndex);
    if (!latest) throw new Error('Chat disappeared during manual operation');
    const ledger = manualLedger(latest);
    const afterIndex = Math.max(-1, (latest.message || []).length - 1);
    for (const event of events) ledger.push({ at: Date.now(), afterIndex, label, event: ITEMXCore.clone(event) });
    const next = ITEMXCore.clone(latest);
    next.scriptstate = { ...(next.scriptstate || {}), [ITEMX_MANUAL_KEY]: JSON.stringify(ledger.slice(-256)) };
    const snapshot = rebuildWithManual(next);
    await Risuai.setChatToIndex(loaded.characterIndex, loaded.chatIndex, ITEMXCore.writeSnapshot(next, snapshot));
    runtime.status = `${label} · ${events.length}건`;
    return rebuildCurrent();
  }

  function modelText(result) {
    if (typeof result === 'string') return result;
    if (typeof result?.result === 'string') return result.result;
    if (typeof result?.content === 'string') return result.content;
    if (typeof result?.text === 'string') return result.text;
    return '';
  }

  function auxStatusText() {
    if (runtime.auxActive > 0) return runtime.auxLabel || '보조 모델 처리 중';
    const last = runtime.auxLast;
    if (!last?.at) return '아직 실행 기록 없음';
    const time = new Date(last.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${last.label} · ${time}`;
  }

  function connectionSummary() {
    const hook = runtime.permissions.replacer === true ? ['모델 훅 연결', 'on'] : runtime.permissions.replacer === false ? ['모델 훅 오류', 'off'] : ['모델 훅 확인 전', 'warn'];
    const dom = runtime.permissions.mainDom === true ? ['화면 연결', 'on'] : runtime.permissions.mainDom === false ? ['화면 권한 필요', 'off'] : ['화면 확인 전', 'warn'];
    const listener = runtime.hooks.listener === 'unsupported' ? ['Pocket 호환', 'warn'] : runtime.hooks.listener ? ['커밋 감지', 'on'] : ['커밋 감지 전', 'warn'];
    return { hook, dom, listener, ready: runtime.permissions.replacer === true && runtime.permissions.mainDom === true };
  }

  async function updateConnectionUi() {
    if (!runtime.mainDoc) return;
    const connection = connectionSummary();
    const chips = [['hook', connection.hook], ['dom', connection.dom], ['listener', connection.listener]];
    for (const [key, [label, tone]] of chips) {
      const chip = await runtime.mainDoc.querySelector(`.x-risu-itemx2-connection-${key}`);
      if (!chip) continue;
      await chip.setTextContent(label);
      await chip.removeClass('x-risu-itemx2-status-chip-on');
      await chip.removeClass('x-risu-itemx2-status-chip-warn');
      await chip.removeClass('x-risu-itemx2-status-chip-off');
      await chip.addClass(`x-risu-itemx2-status-chip-${tone}`);
    }
    const button = await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-connect');
    if (!button) return;
    await button.setTextContent(runtime.connectionBusy ? '확인 중…' : connection.ready ? '다시 확인' : '연결하기');
    if (runtime.connectionBusy) await button.addClass('x-risu-itemx2-root-setting-button-busy');
    else await button.removeClass('x-risu-itemx2-root-setting-button-busy');
  }

  async function updateRootSettingButton(selector, label, enabled = null) {
    if (!runtime.mainDoc) return;
    const button = await runtime.mainDoc.querySelector(selector);
    if (!button) return;
    await button.setTextContent(label);
    if (enabled === true) await button.addClass('x-risu-itemx2-setting-on');
    else if (enabled === false) await button.removeClass('x-risu-itemx2-setting-on');
  }

  async function applyRootSetting(change) {
    if (runtime.settingChangeBusy) return;
    runtime.settingChangeBusy = true;
    try { await change(); }
    finally { runtime.settingChangeBusy = false; }
  }

  async function setAuxOutcome(state, label, events = null) {
    runtime.auxLast = { state, label, events, at: Date.now() };
    runtime.auxLabel = label;
    await syncAuxIndicator();
    if (runtime.auxToastTimer) globalThis.clearTimeout(runtime.auxToastTimer);
    runtime.auxToastTimer = globalThis.setTimeout(() => {
      runtime.auxToastTimer = null;
      void syncAuxIndicator();
    }, 2600);
  }

  async function syncAuxIndicator() {
    try {
      if (!runtime.mainDoc) return;
      const indicator = await runtime.mainDoc.querySelector('.x-risu-itemx2-aux-status');
      if (!indicator) return;
      const label = await indicator.querySelector('.x-risu-itemx2-aux-status-label');
      if (label) await label.setTextContent(runtime.auxActive > 0 ? runtime.auxLabel : runtime.auxLast.label);
      const settingLabel = await runtime.mainDoc.querySelector('.x-risu-itemx2-aux-setting-status');
      if (settingLabel) await settingLabel.setTextContent(auxStatusText());
      const runButton = await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-aux-run');
      if (runButton) {
        await runButton.setTextContent(runtime.auxActive > 0 ? '처리 중…' : '지금 검사');
        if (runtime.auxActive > 0) await runButton.addClass('x-risu-itemx2-root-setting-button-busy');
        else await runButton.removeClass('x-risu-itemx2-root-setting-button-busy');
      }
      const recent = runtime.auxLast.at && Date.now() - runtime.auxLast.at < 2600;
      if (runtime.auxActive > 0 || recent) await indicator.addClass('x-risu-itemx2-aux-status-on');
      else await indicator.removeClass('x-risu-itemx2-aux-status-on');
      if (runtime.auxLast.state === 'done' && runtime.auxActive === 0) await indicator.addClass('x-risu-itemx2-aux-status-done');
      else await indicator.removeClass('x-risu-itemx2-aux-status-done');
      if (runtime.auxLast.state === 'failed' && runtime.auxActive === 0) await indicator.addClass('x-risu-itemx2-aux-status-failed');
      else await indicator.removeClass('x-risu-itemx2-aux-status-failed');
    } catch (error) { fail('aux indicator', error); }
  }

  async function runAuxModel(prompt, label = '보조 모델 처리 중') {
    if (typeof Risuai.runLLMModel !== 'function') throw new Error('이 PocketRisu에는 runLLMModel API가 없습니다.');
    runtime.auxActive += 1;
    runtime.auxLabel = label;
    runtime.auxLast = { state: 'running', label, at: Date.now(), events: null };
    runtime.status = label;
    await syncAuxIndicator();
    try {
      const result = await withTimeout(
        Risuai.runLLMModel({ messages: [{ role: 'user', content: prompt }], mode: 'otherAx', allowPlugins: false }),
        90000,
        '보조 모델이 90초 안에 응답하지 않았습니다.'
      );
      runtime.auxLast = { state: 'done', label: '보조 모델 응답 수신', at: Date.now(), events: null };
      return result;
    } catch (error) {
      runtime.auxLast = { state: 'failed', label: '보조 모델 호출 실패', at: Date.now(), events: null };
      throw error;
    } finally {
      runtime.auxActive = Math.max(0, runtime.auxActive - 1);
      await syncAuxIndicator();
      if (runtime.auxActive === 0) await setAuxOutcome(runtime.auxLast.state, runtime.auxLast.label, runtime.auxLast.events);
    }
  }

  function auxiliaryHistory(chat) {
    try {
      const raw = chat?.scriptstate?.[ITEMX_AUX_KEY];
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }

  async function auxiliaryZeroHistory(ctx) {
    try {
      const raw = await Risuai.pluginStorage.getItem(`auxZero:${ctx.key}`);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }

  async function rememberAuxiliaryZero(ctx, guardKey) {
    const history = await auxiliaryZeroHistory(ctx);
    history[guardKey] = Date.now();
    await Risuai.pluginStorage.setItem(`auxZero:${ctx.key}`, JSON.stringify(Object.fromEntries(Object.entries(history).slice(-24))));
  }

  function messageMetadata(message) {
    if (message?.metadata && typeof message.metadata === 'object') return message.metadata;
    try { return typeof message?.metadata === 'string' ? JSON.parse(message.metadata) : {}; }
    catch { return {}; }
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
    return !chat?.isStreaming && !message?.isStreaming && metadata.bgContinue !== true && !incompleteCommittedOutput(source);
  }

  function automaticAuxSettled(ctx, index, source) {
    const fingerprint = `${ctx.key}:${index}:${ITEMXCore.fnv1a(source)}`;
    if (runtime.auxCandidateFingerprint !== fingerprint) {
      runtime.auxCandidateFingerprint = fingerprint;
      runtime.auxCandidateSince = Date.now();
      runtime.auxCandidateChecks = 1;
      return false;
    }
    runtime.auxCandidateChecks += 1;
    return runtime.auxCandidateChecks >= 2 && Date.now() - runtime.auxCandidateSince >= ITEMX_AUX_SETTLE_MS;
  }

  function stateItemEvidence(chat) {
    const rows = [];
    const keyPattern = /(weapon|armor|item|inventory|equipment|outfit|accessor|gear|belonging|무기|방어구|아이템|장비|의상|소지품)/i;
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

  function auxiliaryVisibleText(value, { itemRefs = true } = {}) {
    let text = String(value || '');
    text = text.replace(/<(thoughts|analysis)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    text = itemRefs ? ITEMXCodex.requestView(ITEMXCore.requestView(text)) : text.replace(ITEMXCore.MARKER_RE, '').replace(ITEMXCodex.MARKER_RE, '');
    text = text.replace(ITEMX_REF_RE, '').replace(ITEMX_CODEX_REF_RE, '');
    return text.replace(/\n{3,}/g, '\n\n').trim();
  }

  function auxiliarySemanticHash(value) {
    return ITEMXCore.fnv1a(auxiliaryVisibleText(value, { itemRefs: false }).replace(/\s+/g, ' ').trim());
  }

  function clipAuxiliaryText(value, max) {
    const text = String(value || '').trim();
    if (text.length <= max) return text;
    const head = Math.floor(max * 0.42), tail = max - head;
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
    const triggeringUser = userIndex >= 0
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
    if (runtime.auxRecoveryPromise) return runtime.auxRecoveryPromise;
    const pending = recoverAuxiliaryOutputNow(options).finally(() => {
      if (runtime.auxRecoveryPromise === pending) runtime.auxRecoveryPromise = null;
    });
    runtime.auxRecoveryPromise = pending;
    return pending;
  }

  async function recoverAuxiliaryOutputNow({ messageIndex = null, force = false } = {}) {
    const ctx = await context();
    if (!ctx || !(await isEnabled(ctx.character))) return null;
    const settings = await outputSettings(ctx.character);
    runtime.debugEnabled = settings.debugEnabled;
    if (!settings.itemsEnabled && !settings.skillsEnabled && !settings.encountersEnabled) return [];
    if (settings.auxOutput === 'off' && !force) return [];
    const index = assistantMessageIndex(ctx.chat, messageIndex);
    if (index < 0) return null;
    const source = messageData(ctx.chat.message[index]);
    if (!force && !automaticAuxReady(ctx.chat, index, source)) return null;
    const sourceHash = ITEMXCore.fnv1a(source);
    const guardKey = `${index}:visible-${auxiliarySemanticHash(source)}:${settings.auxOutput}:${Number(settings.itemsEnabled)}${Number(settings.skillsEnabled)}${Number(settings.encountersEnabled)}`;
    if (auxiliaryHistory(ctx.chat)[guardKey] && !force) return [];
    if ((await auxiliaryZeroHistory(ctx))[guardKey] && !force) return [];
    if (typeof Risuai.runLLMModel !== 'function') return null;

    return enqueue(`aux:${ctx.key}`, async () => {
      if (!force) await delay(350);
      const current = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
      if (!current || ITEMXCore.fnv1a(messageData(current.message?.[index])) !== sourceHash) return null;
      if (!force && !automaticAuxReady(current, index, messageData(current.message[index]))) return null;
      if (auxiliaryHistory(current)[guardKey] && !force) return null;
      const snapshot = rebuildWithManual(current);
      const codexSnapshot = rebuildCodexWithLedger(current);
      const committedNarrative = clipAuxiliaryText(auxiliaryVisibleText(messageData(current.message[index]), { itemRefs: false }), 14000);
      if (!committedNarrative && !force) return null;
      const conversation = auxiliaryConversationContext(current, index);
      const domains = enabledCodexDomains(settings);
      const requested = [settings.itemsEnabled && 'items', settings.skillsEnabled && 'skills', settings.encountersEnabled && 'encounters'].filter(Boolean).join(', ');
      const itemRecoveryRules = settings.itemsEnabled ? `Recover every settled item acquisition, creation, equipment, damage, loss, destruction or material appraisal omitted by the main output, even when the main output already emitted some other ITEMX events. Reuse existing ids from CURRENT INVENTORY. For a genuinely new item, emit a complete itemExam with coherent identity, rarity, visual theme, affinity only when established, and concrete effects supported by context. If the triggering turn and committed output conclusively correct an existing item's name or descriptive identity, including an earlier misspelling, emit itemPatch op=merge for that existing id with only the corrected descriptive fields; never re-emit a complete itemExam merely to correct an existing item. CURRENT INVENTORY is authoritative for continuity, not for a contradicted typo.` : '';
      const codexRecoveryRules = domains.length ? `Recover settled changes only for enabled CODEX domains. For skills, track actual learning, mastery, equipment, sealing or loss. For encounters, track actual hostility, combat or accepted sparring; never register mere mentions, rumors, passive NPCs or unaccepted challenges.` : '';
      const prompt = `${protocolForSettings(settings, ctx.character)}\n\nYou are the ITEMX context-aware auxiliary regeneration pass. Enabled domains: ${requested}. Read the triggering user turn, recent narrative continuity, committed assistant output, authoritative registries, and non-ITEMX state evidence together. Output transport for enabled domains only, with no prose or code fence. Recover every settled change omitted by the main output. ${itemRecoveryRules} ${codexRecoveryRules} Multiple events must be emitted as separate blocks in narrative order. The committed assistant output decides what actually happened; earlier context resolves identity, continuity, ownership, prior damage and user intent. Do not merely catch or copy nouns, do not invent plausible events, do not repeat events already represented in the authoritative registries, and output exactly NONE when nothing is missing.\n\n${settings.itemsEnabled ? `CURRENT INVENTORY:\n${ITEMXCore.anchor(snapshot)}` : 'ITEM DOMAIN DISABLED'}\n\n${domains.length ? `CURRENT ACTIVE SKILLS AND ENCOUNTERS:\n${ITEMXCodex.anchor(codexSnapshot, committedNarrative, 9000, { enabledDomains: domains })}` : 'CODEX DOMAINS DISABLED'}\n\nTRIGGERING USER TURN:\n${conversation.triggeringUser}\n\nRECENT NARRATIVE CONTEXT (oldest to newest):\n${conversation.recent}\n\nCOMMITTED ASSISTANT OUTPUT (visible narrative only):\n${committedNarrative}\n\nNON-ITEMX STATE EVIDENCE:\n${stateItemEvidence(current)}`;
      runtime.status = '보조 출력 검토 중';
      const response = await runAuxModel(prompt, '보조 누락 복구 중');
      const raw = modelText(response);
      if (!raw) throw new Error('보조 출력이 비어 있습니다.');
      const parsed = settings.itemsEnabled ? ITEMXCore.extractResponse(raw, snapshot.registry) : { content: stripItemTransport(raw), events: [], errors: [] };
      const validationRegistry = ITEMXCore.clone(snapshot.registry);
      const validItems = parsed.events.filter((event) => ITEMXCore.applyEvent(validationRegistry, event) != null);
      const codexParsed = ITEMXCodex.extractResponse(parsed.content, codexSnapshot, { enabledDomains: domains });
      const validationCodex = ITEMXCodex.clone(codexSnapshot);
      const validCodex = codexParsed.events.filter((event) => ITEMXCodex.applyEvent(validationCodex, event) != null);
      const valid = [...validItems, ...validCodex];
      debugRecord('auxiliary', { requested, events: valid.length, itemEvents: validItems.length, codexEvents: validCodex.length });
      const allErrors = [...parsed.errors, ...codexParsed.errors];
      if (!valid.length && allErrors.length) throw new Error(`보조 출력 검증 실패 (${allErrors[0]})`);

      const latest = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
      if (!latest || ITEMXCore.fnv1a(messageData(latest.message?.[index])) !== sourceHash) return null;
      if (!valid.length) {
        await rememberAuxiliaryZero(ctx, guardKey);
        if (runtime.activeContextKey === ctx.key) {
          runtime.status = '보조 출력 · 누락 없음';
          await setAuxOutcome('done', '보조 검사 완료 · 누락 없음', 0);
        }
        return valid;
      }
      const next = ITEMXCore.clone(latest);
      const history = auxiliaryHistory(next);
      const reg = ITEMXCore.clone(snapshot.registry);
      const markers = validItems.map((event) => {
        const view = ITEMXCore.clone(ITEMXCore.applyEvent(reg, event));
        return ITEMXCore.marker({ v: ITEMXCore.VERSION, event, view });
      });
      const codexReg = ITEMXCodex.clone(codexSnapshot);
      for (const event of validCodex) {
        const view = ITEMXCodex.clone(ITEMXCodex.applyEvent(codexReg, event));
        markers.push(ITEMXCodex.marker({ v: ITEMXCodex.VERSION, event, view }));
      }
      const markerText = markers.join('\n');
      const message = next.message[index];
      if (typeof message?.data === 'string') message.data = positionMarkersByNarrative(`${message.data.trimEnd()}\n\n${markerText}`);
      else if (typeof message?.content === 'string') message.content = positionMarkersByNarrative(`${message.content.trimEnd()}\n\n${markerText}`);
      else return null;
      const record = { at: Date.now(), events: valid.length };
      history[guardKey] = record;
      next.scriptstate = { ...(next.scriptstate || {}), [ITEMX_AUX_KEY]: JSON.stringify(Object.fromEntries(Object.entries(history).slice(-64))) };
      const compacted = compactMessageTransports(next, index).chat;
      const rebuilt = rebuildWithManual(compacted);
      const stillActive = runtime.activeContextKey === ctx.key;
      if (stillActive) {
        refreshLatest(compacted);
        runtime.uiRemountAfter = Date.now() + 1200;
      }
      await Risuai.setChatToIndex(ctx.characterIndex, ctx.chatIndex, ITEMXCore.writeSnapshot(compacted, rebuilt));
      if (stillActive) {
        runtime.cachedLoaded = null;
        runtime.generation += 1;
        runtime.uiRemountAfter = Date.now() + 1200;
        runtime.status = `보조 출력 · ${valid.length}건 복구`;
      }
      if (stillActive) await setAuxOutcome('done', `보조 복구 완료 · ${valid.length}건`, valid.length);
      return valid;
    }).catch(async (error) => {
      fail('auxiliary recovery', error);
      if (runtime.activeContextKey === ctx.key) {
        runtime.status = '보조 출력 실패';
        await setAuxOutcome('failed', `보조 검사 실패 · ${String(error?.message || error).slice(0, 80)}`);
      }
      return null;
    });
  }

  async function runItemModel(task, loaded, target = null, instruction = '') {
    if (typeof Risuai.runLLMModel !== 'function') throw new Error('이 PocketRisu에는 runLLMModel API가 없습니다.');
    const settings = await outputSettings(loaded.character);
    if (!settings.itemsEnabled) throw new Error('무기·아이템 기능이 OFF입니다. 설정에서 먼저 켜세요.');
    const targetJson = target ? JSON.stringify(target) : 'null';
    const prompt = `${itemxProtocolText(settings.rarityMode)}\n\nYou are running a manual ITEMX management transaction. Output ITEMX transport only; no prose and no code fence.\n${task === 'create' ? 'Create exactly one genuinely new item from the user description. Emit exactly one complete itemExam with a new snake_case id.' : 'Reappraise exactly the supplied existing item. Emit exactly one complete itemExam, keep its id, possession, location, slot and count, and update descriptive/appraisal fields according to the instruction. Never remove it and never create another id.'}\n\nCURRENT INVENTORY:\n${ITEMXCore.anchor(loaded.snapshot)}\n\nTARGET ITEM JSON:\n${targetJson}\n\nUSER INSTRUCTION:\n${instruction || (task === 'create' ? 'Create a fitting new item.' : 'Roll a fresh appraisal while preserving established facts not contradicted by context.')}`;
    const response = await runAuxModel(prompt, task === 'create' ? '신규 아이템 생성 중' : '아이템 재감정 중');
    const raw = modelText(response);
    if (!raw) throw new Error('보조 모델이 빈 응답을 반환했습니다.');
    const parsed = ITEMXCore.extractResponse(raw, loaded.snapshot.registry);
    if (parsed.errors.length || parsed.events.length !== 1 || parsed.events[0].kind !== 'exam') throw new Error(`감정 결과 검증 실패 (${parsed.errors[0] || `events=${parsed.events.length}`})`);
    const event = parsed.events[0];
    if (task === 'create') {
      if (loaded.snapshot.registry.items[event.item.id]) throw new Error('신규 생성이 기존 아이템 id를 덮으려 했습니다.');
      event.item.possession = 'owned'; event.item.location = 'inventory'; event.item.slot = null; event.item.count = Math.max(1, Number(event.item.count) || 1);
    } else {
      if (!target || event.item.id !== target.id) throw new Error('재감정 결과가 대상 id를 보존하지 않았습니다.');
      event.item.possession = target.possession; event.item.location = target.location; event.item.slot = target.slot || null; event.item.count = target.count;
    }
    return event;
  }

  function mainRequestType(type) {
    return !/(translate|emotion|memory|otherax|aux|submodel|image|tts)/i.test(String(type || ''));
  }

  function anchorText(value) {
    return String(value || '').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
  }

  function positionMarkersByNarrative(content) {
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
    const trailerIndex = pieces.findIndex((piece, index) => index % 2 === 0 && /^\s*(?:\[(?:status|state|route)\b|<(?:state|status|route|risu[-_]))/i.test(piece));
    for (const marker of markers) {
      const item = marker.prefix === 'ITEMX2'
        ? (marker.payload?.event?.kind === 'exam' ? marker.payload.event.item : marker.payload?.view)
        : (marker.payload?.view || marker.payload?.event?.entity);
      const name = String(item?.name || '').trim();
      const exact = anchorText(name);
      const terms = name.split(/[\s·:()\[\]{}〈〉《》「」『』/\\,_-]+/u)
        .map(anchorText).filter((term) => term.length >= 2);
      let bestIndex = -1, bestScore = 0;
      for (let index = 0; index < pieces.length; index += 2) {
        const paragraph = anchorText(pieces[index]);
        if (!paragraph) continue;
        const exactHit = exact.length >= 2 && paragraph.includes(exact);
        const hits = terms.filter((term) => paragraph.includes(term)).length;
        const enoughTerms = terms.length > 1 ? hits >= Math.min(2, terms.length) : hits === 1;
        if (!exactHit && !enoughTerms) continue;
        const score = (exactHit ? 10000 : 0) + hits * 100;
        if (score > bestScore) { bestScore = score; bestIndex = index; }
      }
      if (bestIndex < 0) {
        const prefixText = source.slice(0, marker.index).replace(ITEMXCore.MARKER_RE, '').replace(ITEMXCodex.MARKER_RE, '');
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
      pieces[index] = `${pieces[index].trimEnd()}\n\n${rows.map((row) => `<!--${row.prefix}:${row.code}-->`).join('\n')}`;
    }
    let positioned = pieces.join('').trimEnd();
    return positioned;
  }

  function scheduleLegacyCommitRecovery(confirm = false) {
    if (runtime.auxActive > 0 || runtime.auxRecoveryPromise) return;
    if (runtime.legacyCommitTimer) globalThis.clearTimeout(runtime.legacyCommitTimer);
    runtime.legacyCommitTimer = globalThis.setTimeout(async () => {
      runtime.legacyCommitTimer = null;
      try {
        await rebuildCurrent();
        await catchUpLatestOutput();
        await ensureRootInventory();
        if (!confirm && runtime.auxActive === 0 && !runtime.auxRecoveryPromise) scheduleLegacyCommitRecovery(true);
      } catch (error) { fail('legacy commit recovery', error); }
    }, 1800);
  }

  async function repairCommittedTransport(ctx, index, source) {
    const settings = await outputSettings(ctx.character);
    const base = rebuildWithManual(ctx.chat).registry;
    const parsed = settings.itemsEnabled ? ITEMXCore.extractResponse(source, base) : { content: stripItemTransport(source), events: [], errors: [] };
    const codexBase = rebuildCodexWithLedger(ctx.chat);
    const codexParsed = ITEMXCodex.extractResponse(parsed.content, codexBase, { enabledDomains: enabledCodexDomains(settings) });
    const positioned = positionMarkersByNarrative(codexParsed.content);
    const needsCompaction = ITEMXCore.MARKER_RE.test(positioned) || ITEMXCodex.MARKER_RE.test(positioned);
    ITEMXCore.MARKER_RE.lastIndex = 0; ITEMXCodex.MARKER_RE.lastIndex = 0;
    if (positioned === source && !needsCompaction) return { ctx, source };
    const latest = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
    if (!latest || ITEMXCore.fnv1a(messageData(latest.message?.[index])) !== ITEMXCore.fnv1a(source)) return null;
    const next = ITEMXCore.clone(latest);
    const message = next.message?.[index];
    if (typeof message?.data === 'string') message.data = positioned;
    else if (typeof message?.content === 'string') message.content = positioned;
    else return null;
    const compacted = compactMessageTransports(next, index).chat;
    const compactedSource = messageData(compacted.message?.[index]);
    const snapshot = rebuildWithManual(compacted);
    const stillActive = runtime.activeContextKey === ctx.key;
    if (stillActive) {
      refreshLatest(compacted);
      runtime.rootFingerprint = '';
      runtime.cachedLoaded = null;
      runtime.generation += 1;
      runtime.uiRemountAfter = Date.now() + 1200;
    }
    await Risuai.setChatToIndex(ctx.characterIndex, ctx.chatIndex, ITEMXCore.writeSnapshot(compacted, snapshot));
    const errors = parsed.errors.length + codexParsed.errors.length, events = parsed.events.length + codexParsed.events.length;
    if (stillActive) runtime.status = errors ? `깨진 전송 격리 · ${errors}건` : `누락 훅 복구 · ${events}건`;
    return { ctx: { ...ctx, chat: compacted }, source: compactedSource };
  }

  async function catchUpLatestOutput() {
    if (!runtime.activeContextKey || runtime.auxActive > 0 || runtime.auxRecoveryPromise || runtime.bodyFxScrollActive) return;
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
    if (runtime.activeContextKey !== ctx.key) return;
    const fingerprint = `${ctx.key}:${index}:visible-${auxiliarySemanticHash(source)}`;
    if (fingerprint === runtime.catchUpFingerprint) return;
    if (fingerprint === runtime.catchUpFailedFingerprint && Date.now() < runtime.catchUpRetryAt) return;
    const result = await recoverAuxiliaryOutput({ messageIndex: index });
    if (Array.isArray(result)) {
      runtime.catchUpFingerprint = fingerprint;
      runtime.catchUpFailedFingerprint = '';
      runtime.catchUpFailures = 0;
      runtime.catchUpRetryAt = 0;
    } else {
      runtime.catchUpFailedFingerprint = fingerprint;
      runtime.catchUpFailures = Math.min(runtime.catchUpFailures + 1, 6);
      runtime.catchUpRetryAt = Date.now() + Math.min(120000, 5000 * (2 ** runtime.catchUpFailures));
    }
    await ensureRootInventory();
  }

  const beforeRequest = async (messages, type) => {
    if (!mainRequestType(type)) return messages;
    try {
      const loaded = await rebuildCurrent();
      if (!loaded || !(await isEnabled(loaded.character))) return messages;
      const settings = await outputSettings(loaded.character);
      runtime.debugEnabled = settings.debugEnabled;
      if (!settings.mainOutput) return messages;
      if (!settings.itemsEnabled && !settings.skillsEnabled && !settings.encountersEnabled) return messages;
      const safeMessages = (messages || []).map((message) => ({ ...message, content: ITEMXCodex.requestView(ITEMXCore.requestView(message.content)).replace(ITEMX_REF_RE, '').replace(ITEMX_CODEX_REF_RE, '') }));
      const recent = safeMessages.slice(-4).map((message) => message.content || '').join('\n');
      const domains = enabledCodexDomains(settings);
      const instruction = `${protocolForSettings(settings, loaded.character)}${settings.itemsEnabled ? `\n\n${ITEMXCore.anchor(loaded.snapshot)}` : ''}${domains.length ? `\n\n${ITEMXCodex.anchor(loaded.codexSnapshot, recent, 9000, { enabledDomains: domains })}` : ''}`;
      debugRecord('beforeRequest', { items: settings.itemsEnabled, skills: settings.skillsEnabled, encounters: settings.encountersEnabled, messages: safeMessages.length });
      return [{ role: 'system', content: instruction, name: 'ITEMX_2_PROTOCOL' }, ...safeMessages];
    } catch (error) { fail('beforeRequest', error); return messages; }
  };

  async function processOutput(content, type) {
    if (!mainRequestType(type)) return content;
    try {
      const ctx = await context();
      if (!ctx) return content;
      const enabled = await isEnabled(ctx.character);
      const settings = await outputSettings(ctx.character);
      runtime.debugEnabled = settings.debugEnabled;
      if (!enabled || !settings.mainOutput) return stripAllTransport(content);
      const base = rebuildWithManual(ctx.chat).registry;
      const result = settings.itemsEnabled ? ITEMXCore.extractResponse(content, base) : { content: stripItemTransport(content), events: [], errors: [] };
      const codexResult = ITEMXCodex.extractResponse(result.content, rebuildCodexWithLedger(ctx.chat), { enabledDomains: enabledCodexDomains(settings) });
      const positioned = positionMarkersByNarrative(codexResult.content);
      if (result.events.length || result.errors.length || codexResult.events.length || codexResult.errors.length || codexResult.content !== content) {
        runtime.latestOutput = positioned;
        runtime.latestMarkers = markerCodes(positioned);
        runtime.pendingMarkers = new Set(runtime.latestMarkers);
        runtime.pendingMarkersAt = Date.now();
        const errors = result.errors.length + codexResult.errors.length, events = result.events.length + codexResult.events.length;
        runtime.status = errors ? `격리 ${errors}건` : `메인 출력 ${events}건 처리`;
        runtime.generation += 1;
        debugRecord('processOutput', { itemEvents: result.events.length, codexEvents: codexResult.events.length, errors });
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
    if (runtime.hooks.listener === 'unsupported' && runtime.auxActive === 0 && !runtime.auxRecoveryPromise) scheduleLegacyCommitRecovery();
    return processed;
  };

  const displayHandler = (content) => {
    const source = positionMarkersByNarrative(String(content || ''));
    let found = false, hasFullCard = false;
    const renderPayload = (cacheKey, payload, motion) => {
      const key = `${cacheKey}:${motion}`;
      if (runtime.markerHtmlCache.has(key)) return runtime.markerHtmlCache.get(key);
      const html = ITEMXRenderer.renderMarkerPayload(payload, { inline: true, motion });
      runtime.markerHtmlCache.set(key, html);
      while (runtime.markerHtmlCache.size > 64) runtime.markerHtmlCache.delete(runtime.markerHtmlCache.keys().next().value);
      return html;
    };
    const rendered = source.replace(ITEMXCore.MARKER_RE, (_, code) => {
      found = true;
      const payload = ITEMXCore.decodePayload(code);
      if (!payload || payload.error) return '';
      const html = renderPayload(`item:${code}`, payload, 'full');
      if (html) { hasFullCard = true; return html; }
      const item = payload.event?.kind === 'exam' ? payload.event.item : payload.view;
      return item ? `<span class="itemx-event-chip">${ITEMXCore.esc(item.emoji || '❔')} ${ITEMXCore.esc(item.name || item.id)}</span>` : '';
    }).replace(ITEMXCodex.MARKER_RE, (_, code) => {
      found = true;
      const payload = ITEMXCodex.decodePayload(code), entity = payload?.view || payload?.event?.entity;
      if (!entity || payload.error) return '';
      const kind = payload.event?.domain === 'skill' ? '스킬' : '조우 도감';
      return `<span class="itemx-event-chip">${ITEMXCore.esc(entity.glyph || '✦')} ${ITEMXCore.esc(kind)} · ${ITEMXCore.esc(entity.name || entity.id)}</span>`;
    }).replace(ITEMX_REF_RE, (_, ref, inline) => {
      found = true;
      const payload = inlineViewPayload(inline, 'item') || runtime.eventPayloads.get(`item:${ref}`);
      if (!payload || payload.error) return `<span class="itemx-event-chip">📦 ITEMX · 기록 복원 중</span>`;
      const html = renderPayload(`item-ref:${ref}`, payload, 'full');
      if (html) { hasFullCard = true; return html; }
      const item = payload.view || payload.event?.item;
      return item ? `<span class="itemx-event-chip">${ITEMXCore.esc(item.emoji || '❔')} ${ITEMXCore.esc(item.name || item.id)}</span>` : `<span class="itemx-event-chip">📦 ITEMX · ${ITEMXCore.esc(ref)}</span>`;
    }).replace(ITEMX_CODEX_REF_RE, (_, ref, inline) => {
      found = true;
      const payload = inlineViewPayload(inline, 'codex') || runtime.eventPayloads.get(`codex:${ref}`), entity = payload?.view || payload?.event?.entity;
      if (!entity || payload.error) return `<span class="itemx-event-chip">✦ 도감 기록 복원 중</span>`;
      const kind = payload.event?.domain === 'skill' ? '스킬' : '조우 도감';
      return `<span class="itemx-event-chip">${ITEMXCore.esc(entity.glyph || '✦')} ${ITEMXCore.esc(kind)} · ${ITEMXCore.esc(entity.name || entity.id)}</span>`;
    });
    if (!found) return content;
    if (runtime.mainStyle) return rendered;
    return `<style>${hasFullCard ? ITEMX_CHAT_STYLE : ITEMX_CHIP_STYLE}</style>${rendered}`;
  };

  function beginBodyScrollEffects() {
    if (runtime.bodyFxStartTimer) globalThis.clearTimeout(runtime.bodyFxStartTimer);
    runtime.bodyFxStartTimer = globalThis.setTimeout(() => {
      runtime.bodyFxStartTimer = null;
      if (runtime.bodyFxScrollActive || !runtime.bodyFxClassOwner) return;
      runtime.bodyFxScrollActive = true;
      void runtime.bodyFxClassOwner.addClass('x-risu-itemx-body-scrolling').catch(() => {});
    }, 70);
  }

  function endBodyScrollEffects(delayMs = 0) {
    if (runtime.bodyFxStartTimer) globalThis.clearTimeout(runtime.bodyFxStartTimer);
    runtime.bodyFxStartTimer = null;
    if (runtime.bodyFxScrollTimer) globalThis.clearTimeout(runtime.bodyFxScrollTimer);
    runtime.bodyFxScrollTimer = globalThis.setTimeout(() => {
      runtime.bodyFxScrollTimer = null;
      if (!runtime.bodyFxScrollActive) return;
      runtime.bodyFxScrollActive = false;
      if (runtime.bodyFxClassOwner) void runtime.bodyFxClassOwner.removeClass('x-risu-itemx-body-scrolling').catch(() => {});
      scheduleHostDomSync(180);
    }, delayMs);
  }

  async function installBodyEffectGovernor() {
    if (!runtime.mainDoc) return;
    try {
      runtime.bodyFxClassOwner = await runtime.mainDoc.querySelector('.chattext') || runtime.bodyFxClassOwner;
      if (runtime.bodyFxEventOwner) return;
      const body = await runtime.mainDoc.querySelector('body');
      if (!body) return;
      runtime.bodyFxEventOwner = body;
      const bindings = [
        ['pointerdown', beginBodyScrollEffects],
        ['pointerup', () => endBodyScrollEffects(900)],
        ['pointercancel', () => endBodyScrollEffects(120)],
        ['scrollend', () => endBodyScrollEffects(40)]
      ];
      for (const [type, handler] of bindings) {
        const id = await body.addEventListener(type, handler, true);
        runtime.bodyFxEventIds.push({ type, id });
      }
    } catch (error) { debugRecord('body effect governor install', error?.message || String(error)); }
  }

  async function installMainStyle() {
    try {
      if (runtime.mainStyle && runtime.mainStylePosition === runtime.badgePosition) {
        try {
          if (!(await runtime.mainStyle.getParent())) throw new Error('detached style owner');
          runtime.permissions.mainDom = true;
          runtime.lastDomError = '';
          await installBodyEffectGovernor();
          await installHostObserver();
          return true;
        } catch {
          runtime.mainStyle = null;
          runtime.mainDoc = null;
          runtime.bodyFxClassOwner = null;
        }
      }
      const doc = await Risuai.getRootDocument();
      if (!doc) {
        runtime.permissions.mainDom = false;
        runtime.lastDomError = '메인 문서 API가 null을 반환했습니다';
        return false;
      }
      runtime.mainDoc = doc;
      runtime.permissions.mainDom = true;
      const existing = await doc.querySelector('style[x-itemx2-style="owner"]');
      if (existing) { runtime.mainStyle = existing; await existing.setTextContent(mainStyleText()); runtime.mainStylePosition = runtime.badgePosition; await installBodyEffectGovernor(); await installHostObserver(); return true; }
      const style = await doc.createElement('style');
      await style.setAttribute('x-itemx2-style', 'owner');
      await style.setTextContent(mainStyleText());
      const head = await doc.querySelector('head');
      if (head) await head.appendChild(style); else await doc.appendChild(style);
      runtime.mainStyle = style;
      runtime.mainStylePosition = runtime.badgePosition;
      runtime.lastDomError = '';
      await installBodyEffectGovernor();
      await installHostObserver();
      return true;
    } catch (error) {
      runtime.permissions.mainDom = false;
      runtime.mainStyle = null;
      runtime.mainStylePosition = '';
      runtime.mainDoc = null;
      runtime.lastDomError = String(error?.message || error || '알 수 없는 DOM 오류');
      fail('main style connection', error);
      return false;
    }
  }

  function itemsOf(snapshot) {
    const reg = snapshot?.registry || ITEMXCore.newRegistry();
    return reg.order.map((id) => reg.items[id]).filter(Boolean);
  }

  function rootPageItems(loaded) {
    const all = itemsOf(loaded?.snapshot).slice(0, 60);
    const pageCount = Math.max(1, Math.ceil(all.length / ITEMX_ROOT_PAGE_SIZE));
    runtime.rootItemPage = Math.max(0, Math.min(pageCount - 1, runtime.rootItemPage));
    const start = runtime.rootItemPage * ITEMX_ROOT_PAGE_SIZE;
    return all.slice(start, start + ITEMX_ROOT_PAGE_SIZE);
  }

  function itemDetailHtml(item) {
    const key = `${item.id}:${ITEMXCore.fnv1a(JSON.stringify(item))}`;
    if (runtime.detailHtmlCache.has(key)) return runtime.detailHtmlCache.get(key);
    const html = ITEMXRenderer.renderCard(item, { motion: 'full' });
    runtime.detailHtmlCache.set(key, html);
    while (runtime.detailHtmlCache.size > 60) runtime.detailHtmlCache.delete(runtime.detailHtmlCache.keys().next().value);
    return html;
  }

  async function queryMainClass(className) {
    if (!runtime.mainDoc) return null;
    return await runtime.mainDoc.querySelector(`.x-risu-${className}`)
      || await runtime.mainDoc.querySelector(`.${className}`);
  }

  async function installRootItemDetailClicks(loaded) {
    const detailItems = rootPageItems(loaded);
    await Promise.all(detailItems.map(async (item, index) => {
      const tile = await queryMainClass(`itemx2-root-tile-${index}`);
      if (!tile) return;
      await tile.addEventListener('click', async () => {
        try {
          const detail = await queryMainClass(`itemx2-root-detail-body-${index}`);
          if (detail) await detail.setInnerHTML(itemDetailHtml(item));
        } catch (error) { fail('item detail click', error); }
      });
    }));
  }

  async function removeRootDrawer() {
    if (runtime.feedbackTimer) globalThis.clearTimeout(runtime.feedbackTimer);
    runtime.feedbackTimer = null;
    try { if (runtime.rootDrawer) await runtime.rootDrawer.remove(); } catch {}
    if (runtime.mainDoc) {
      try {
        const safeRoots = await runtime.mainDoc.querySelectorAll('[x-itemx2-drawer="owner"]');
        const roots = await Risuai.unwarpSafeArray(safeRoots);
        for (const root of roots) { try { await root.remove(); } catch {} }
      } catch (error) { fail('remove duplicate root drawers', error); }
    }
    runtime.rootDrawer = null;
    runtime.rootFingerprint = '';
    runtime.rootContentReady = false;
    runtime.badgeEventOwner = null;
    runtime.badgeEventId = null;
  }

  async function mountRootLoading(label = 'ITEMX 초기화 중…') {
    if (!runtime.mainDoc) return false;
    await removeRootDrawer();
    const root = await runtime.mainDoc.createElement('div');
    await root.setAttribute('x-itemx2-drawer', 'owner');
    await root.setClassName('x-risu-itemx2-root-drawer x-risu-itemx2-booting');
    await root.setInnerHTML(`<div class="itemx2-boot-card" role="status" aria-live="polite"><i></i><span><strong>${ITEMXCore.esc(label)}</strong><small>화면과 모델 연결을 준비하고 있습니다.</small></span></div>`);
    const body = await runtime.mainDoc.querySelector('body');
    if (!body) return false;
    await body.appendChild(root);
    runtime.rootDrawer = root;
    runtime.rootFingerprint = 'booting';
    return true;
  }

  async function updateRootLoading(label) {
    if (!runtime.mainDoc || !runtime.rootDrawer) return;
    try {
      const target = await runtime.mainDoc.querySelector('.x-risu-itemx2-boot-card strong');
      if (target) await target.setTextContent(label);
    } catch (error) { fail('loading label', error); }
  }

  async function showRootFeedback(message, tone = 'success', timeoutMs = 2600) {
    if (!runtime.mainDoc || !runtime.rootDrawer) return false;
    try {
      const toast = await runtime.mainDoc.querySelector('.x-risu-itemx2-feedback');
      if (!toast) return false;
      if (runtime.feedbackTimer) globalThis.clearTimeout(runtime.feedbackTimer);
      runtime.feedbackTimer = null;
      await toast.setTextContent(message);
      for (const value of ['success', 'error', 'working']) await toast.removeClass(`x-risu-itemx2-feedback-${value}`);
      await toast.addClass(`x-risu-itemx2-feedback-${tone}`);
      await toast.addClass('x-risu-itemx2-feedback-on');
      if (timeoutMs > 0) {
        runtime.feedbackTimer = globalThis.setTimeout(() => {
          void toast.removeClass('x-risu-itemx2-feedback-on').catch(() => {});
          runtime.feedbackTimer = null;
        }, timeoutMs);
      }
      return true;
    } catch (error) {
      fail('root feedback', error);
      return false;
    }
  }

  function scheduleHostDomSync(delayMs = 320) {
    if (runtime.hostSyncTimer) globalThis.clearTimeout(runtime.hostSyncTimer);
    runtime.hostSyncTimer = globalThis.setTimeout(async () => {
      runtime.hostSyncTimer = null;
      if (runtime.bodyFxScrollActive) { scheduleHostDomSync(420); return; }
      if (runtime.hostSyncBusy) return;
      runtime.hostSyncBusy = true;
      try {
        await installBodyEffectGovernor();
        await ensureRootInventory();
        await syncHostSettingsVisibility();
      } catch (error) { debugRecord('host DOM sync', error?.message || String(error)); }
      finally { runtime.hostSyncBusy = false; }
    }, delayMs);
  }

  async function installHostObserver() {
    if (!runtime.mainDoc || runtime.hostObserver || typeof Risuai.createMutationObserver !== 'function') return;
    try {
      const body = await runtime.mainDoc.querySelector('body');
      if (!body) return;
      runtime.hostObserver = await Risuai.createMutationObserver(() => scheduleHostDomSync());
      if (runtime.hostObserver?.observe) await runtime.hostObserver.observe(body, { childList: true, subtree: true });
    } catch (error) {
      runtime.hostObserver = null;
      debugRecord('host observer install', error?.message || String(error));
    }
  }

  async function hostPluginSettingsVisible() {
    if (!runtime.mainDoc || runtime.allowDrawerOverSettings) return false;
    try {
      const safeTargets = await runtime.mainDoc.querySelectorAll('button,[role="button"]');
      const targets = await Risuai.unwarpSafeArray(safeTargets);
      for (const target of targets.slice(0, 96)) {
        const text = String(await target.textContent() || '').replace(/\s+/g, ' ').trim();
        if (!text.includes('ITEMX 2 · 권한 및 설정')) continue;
        const rect = await target.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return true;
      }
    } catch (error) { fail('host settings visibility', error); }
    return false;
  }

  async function syncHostSettingsVisibility() {
    if (!runtime.rootDrawer) return;
    const visible = await hostPluginSettingsVisible();
    if (runtime.hostSettingsVisible === visible) return;
    runtime.hostSettingsVisible = visible;
    try {
      if (visible) await runtime.rootDrawer.addClass('x-risu-itemx2-host-settings');
      else await runtime.rootDrawer.removeClass('x-risu-itemx2-host-settings');
    } catch (error) { fail('host settings badge visibility', error); }
  }

  async function setRootOpen(open) {
    if (!runtime.rootDrawer) return false;
    try {
      if (!(await runtime.rootDrawer.getParent())) return false;
      if (open) await runtime.rootDrawer.addClass('x-risu-itemx2-is-open');
      else {
        await runtime.rootDrawer.removeClass('x-risu-itemx2-is-open');
        runtime.allowDrawerOverSettings = false;
        await syncHostSettingsVisibility();
      }
      return true;
    } catch { return false; }
  }

  async function resetRuntimeForContext(active) {
    const nextKey = active?.key || '';
    if (runtime.activeContextKey === nextKey) return false;
    runtime.activeContextKey = nextKey;
    runtime.rootItemPage = 0;
    runtime.cachedLoaded = null;
    runtime.cachedGeneration = -1;
    runtime.pendingMarkers.clear();
    runtime.pendingMarkersAt = 0;
    runtime.markerHtmlCache.clear();
    runtime.detailHtmlCache.clear();
    runtime.catchUpFingerprint = '';
    runtime.catchUpFailedFingerprint = '';
    runtime.catchUpFailures = 0;
    runtime.catchUpRetryAt = 0;
    runtime.auxCandidateFingerprint = '';
    runtime.uiRemountAfter = 0;
    if (runtime.legacyCommitTimer) globalThis.clearTimeout(runtime.legacyCommitTimer);
    runtime.legacyCommitTimer = null;
    if (runtime.bodyFxStartTimer) globalThis.clearTimeout(runtime.bodyFxStartTimer);
    runtime.bodyFxStartTimer = null;
    if (runtime.bodyFxScrollTimer) globalThis.clearTimeout(runtime.bodyFxScrollTimer);
    runtime.bodyFxScrollTimer = null;
    if (runtime.bodyFxScrollActive && runtime.bodyFxClassOwner) {
      try { await runtime.bodyFxClassOwner.removeClass('x-risu-itemx-body-scrolling'); } catch {}
    }
    runtime.bodyFxScrollActive = false;
    runtime.bodyFxClassOwner = null;
    refreshLatest(active?.chat || { message: [], scriptstate: {} });
    await removeRootDrawer();
    return true;
  }

  async function ensureRootInventory() {
    if (runtime.bodyFxScrollActive) return;
    runtime.remountFallbackAt = Date.now();
    const active = await context();
    const contextChanged = await resetRuntimeForContext(active);
    if (!active) {
      runtime.status = '채팅 진입 대기';
      return;
    }
    if (runtime.remounting) return;
    if (!contextChanged && (runtime.auxActive > 0 || runtime.auxRecoveryPromise || Date.now() < runtime.uiRemountAfter)) return;
    runtime.remounting = true;
    try {
      if (!runtime.hooks.output || !runtime.hooks.display || !runtime.hooks.before || !runtime.hooks.after) await installPipelineHooks();
      if (contextChanged) {
        if (!runtime.mainDoc && !(await installMainStyle())) return;
        const loaded = await rebuildCurrent({ upgradeDisplayRefs: true });
        if (loaded) await openRootInventory({ open: false, loaded });
        void checkForUpdate();
        return;
      }
      if (!runtime.mainDoc && !(await installMainStyle())) return;
      let drawerAttached = false;
      if (runtime.rootDrawer) {
        try { drawerAttached = Boolean(await runtime.rootDrawer.getParent()); }
        catch { runtime.rootDrawer = null; }
      }
      if (!drawerAttached) {
        const safeMounted = await runtime.mainDoc.querySelectorAll('[x-itemx2-drawer="owner"]');
        const mounted = await Risuai.unwarpSafeArray(safeMounted);
        if (mounted.length === 1) {
          runtime.rootDrawer = mounted[0];
          await installNativeBadgeClick(runtime.rootDrawer);
        } else {
          runtime.rootDrawer = null;
          runtime.badgeEventOwner = null;
          runtime.badgeEventId = null;
          await openRootInventory({ open: false });
          return;
        }
      }
      let styleAttached = false;
      if (runtime.mainStyle) {
        try { styleAttached = Boolean(await runtime.mainStyle.getParent()); }
        catch { runtime.mainStyle = null; }
      }
      if (!styleAttached) {
        const style = await runtime.mainDoc.querySelector('style[x-itemx2-style="owner"]');
        if (style) runtime.mainStyle = style;
        else { runtime.mainStyle = null; await installMainStyle(); }
      }
    } catch (error) { fail('root remount', error); }
    finally { runtime.remounting = false; }
  }

  async function loadCodexPortraits(character, codexSnapshot) {
    const result = {}, catalog = new Map(ITEMXCodex.assetCatalog(character, 160, true).map((row) => [row.name, row]));
    if (typeof Risuai.readImage !== 'function') return result;
    const asDataUrl = (value, ext = '') => {
      if (typeof value === 'string') return /^(?:blob:|https?:|data:image\/(?:png|jpeg|webp|gif);base64,)/i.test(value) ? value : '';
      let bytes = null;
      if (value instanceof Uint8Array) bytes = value;
      else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
      else if (Array.isArray(value)) bytes = Uint8Array.from(value);
      else if (value?.data instanceof Uint8Array) bytes = value.data;
      if (!bytes?.length || bytes.length > 12 * 1024 * 1024) return '';
      const lower = String(ext || '').toLowerCase();
      const mime = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png'
        : bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg'
          : bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 ? 'image/webp'
            : bytes[0] === 0x47 && bytes[1] === 0x49 ? 'image/gif'
              : ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[lower] || '');
      if (!mime) return '';
      let binary = ''; for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      return `data:${mime};base64,${btoa(binary)}`;
    };
    const names = (codexSnapshot?.monsters?.order || []).map((id) => codexSnapshot.monsters.entries[id]?.portrait).filter((name) => name && name !== 'NONE').slice(0, 20);
    await Promise.all([...new Set(names)].map(async (name) => {
      const asset = catalog.get(name); if (!asset) return;
      const cacheKey = `${character?.chaId || character?.id || 'character'}:${asset.id}:${asset.ext || ''}`;
      if (runtime.portraitCache.has(cacheKey)) { result[name] = runtime.portraitCache.get(cacheKey); return; }
      try {
        const image = asDataUrl(await Risuai.readImage(asset.id), asset.ext);
        if (image) {
          result[name] = image;
          if (image.length <= 4 * 1024 * 1024) {
            runtime.portraitCache.set(cacheKey, image);
            runtime.portraitCacheBytes += image.length;
            while (runtime.portraitCache.size > 24 || runtime.portraitCacheBytes > 16 * 1024 * 1024) {
              const oldest = runtime.portraitCache.keys().next().value, removed = runtime.portraitCache.get(oldest) || '';
              runtime.portraitCache.delete(oldest); runtime.portraitCacheBytes = Math.max(0, runtime.portraitCacheBytes - removed.length);
            }
          }
        }
      } catch {}
    }));
    return result;
  }

  function skillSummaryHtml(skill) {
    const filled = Math.max(0, Math.min(5, Math.ceil((Number(skill.mastery) || 0) / 20)));
    return `<span class="itemx2-codex-glyph">${ITEMXCore.esc(skill.glyph || '✦')}</span><span class="itemx2-codex-copy"><strong>${ITEMXCore.esc(skill.name)}</strong><small>${ITEMXCore.esc(skill.rank)} · Lv.${Number(skill.level) || 1} · 숙련 ${Number(skill.mastery) || 0}%</small><span class="itemx2-codex-tags"><i>${ITEMXCore.esc(skill.type)}</i><i>${ITEMXCore.esc(skill.status)}</i>${skill.affinity ? `<i>${ITEMXCore.esc(skill.affinity)}</i>` : ''}</span></span><span class="itemx2-skill-meta"><small>소모</small><b>${ITEMXCore.esc(skill.cost || '없음')}</b><small>재사용</small><b>${ITEMXCore.esc(skill.cooldown || '없음')}</b></span><span class="itemx2-mastery">${Array.from({ length: 5 }, (_, index) => `<i class="${index < filled ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  function skillPageHtml(skill, back) {
    const mastery = Math.max(0, Math.min(10, Math.ceil((Number(skill.mastery) || 0) / 10)));
    const effects = (skill.effects || []).map((one) => `<i>${ITEMXCore.esc(one)}</i>`).join('') || '<i>기록 없음</i>';
    return `<div class="itemx-codex-page itemx2-codex-page">${back}<section class="itemx-codex-hero itemx-skill-hero"><span class="itemx-codex-hero-glyph">${ITEMXCore.esc(skill.glyph || '✦')}</span><span class="itemx-codex-hero-copy"><small>ARCANE SKILL RECORD</small><strong>${ITEMXCore.esc(skill.name)}</strong><span>${ITEMXCore.esc(skill.rank)} · ${ITEMXCore.esc(skill.school || '미분류')} · ${ITEMXCore.esc(skill.status)}</span></span></section><div class="itemx-codex-stat-grid"><span class="itemx-codex-stat"><small>LEVEL</small><strong>Lv.${Number(skill.level) || 1}</strong></span><span class="itemx-codex-stat"><small>TYPE / TARGET</small><strong>${ITEMXCore.esc(skill.type || '미분류')} · ${ITEMXCore.esc(skill.target || '미상')}</strong></span><span class="itemx-codex-stat"><small>COST</small><strong>${ITEMXCore.esc(skill.cost || '없음')}</strong></span><span class="itemx-codex-stat"><small>COOLDOWN</small><strong>${ITEMXCore.esc(skill.cooldown || '없음')}</strong></span></div><section class="itemx-codex-section"><h4>숙련도 · ${Number(skill.mastery) || 0}%</h4><span class="itemx-codex-mastery">${Array.from({ length: 10 }, (_, index) => `<i class="${index < mastery ? 'on' : ''}"></i>`).join('')}</span></section>${skill.description ? `<section class="itemx-codex-section"><h4>기술 해설</h4><p>${ITEMXCore.esc(skill.description)}</p></section>` : ''}<section class="itemx-codex-section"><h4>발현 효과</h4><span class="itemx-codex-chip-row">${effects}</span></section><section class="itemx-codex-section"><h4>성장 기록</h4><p>${ITEMXCore.esc(skill.growth || '기록 없음')}</p><small>ID · ${ITEMXCore.esc(skill.id)}</small></section></div>`;
  }

  function monsterSummaryHtml(monster, portrait = '') {
    const visual = portrait ? `<img src="${ITEMXCore.esc(portrait)}" alt="">` : `<span class="itemx2-codex-glyph">${ITEMXCore.esc(monster.glyph || '◈')}</span>`;
    return `${visual}<span class="itemx2-codex-copy"><strong>${ITEMXCore.esc(monster.name)}</strong><small>${ITEMXCore.esc(monster.kind)} · 위협 ${ITEMXCore.esc(monster.threat)} · ${ITEMXCore.esc(monster.status)}</small><span class="itemx2-codex-tags"><i>${ITEMXCore.esc(monster.relation)}</i>${(monster.weaknesses || []).slice(0, 2).map((one) => `<i>약점 ${ITEMXCore.esc(one)}</i>`).join('')}</span></span><span class="itemx2-codex-glyph">${monster.active ? '교전' : '기록'}</span>`;
  }

  function monsterPageHtml(monster, portrait, back) {
    const visual = portrait ? `<img class="itemx-monster-portrait" src="${ITEMXCore.esc(portrait)}" alt="">` : `<span class="itemx-codex-hero-glyph">${ITEMXCore.esc(monster.glyph || '◈')}</span>`;
    const chips = (label, values, fallback) => `<section class="itemx-codex-section"><h4>${label}</h4><span class="itemx-codex-chip-row">${(values || []).map((one) => `<i>${ITEMXCore.esc(one)}</i>`).join('') || `<i>${fallback}</i>`}</span></section>`;
    return `<div class="itemx-codex-page itemx2-codex-page">${back}<section class="itemx-codex-hero itemx-monster-hero"><b class="itemx-threat-banner">THREAT · ${ITEMXCore.esc(monster.threat || '미상')}</b>${visual}<span class="itemx-codex-hero-copy"><small>ENCOUNTER ARCHIVE</small><strong>${ITEMXCore.esc(monster.name)}</strong><span>${ITEMXCore.esc(monster.kind || '미분류')} · ${ITEMXCore.esc(monster.relation)} · ${ITEMXCore.esc(monster.status)}</span></span></section><div class="itemx-codex-stat-grid"><span class="itemx-codex-stat"><small>ENCOUNTERS</small><strong>${Number(monster.encounterCount) || 1}회</strong></span><span class="itemx-codex-stat"><small>COMBAT STATE</small><strong>${monster.active ? '현재 교전 기록' : '보관 기록'}</strong></span></div>${monster.description ? `<section class="itemx-codex-section"><h4>관찰 기록</h4><p>${ITEMXCore.esc(monster.description)}</p></section>` : ''}${chips('별칭', monster.aliases, '없음')}${chips('확인된 약점', monster.weaknesses, '미상')}${chips('확인된 내성', monster.resistances, '미상')}${chips('관측 행동', monster.moves, '미상')}<section class="itemx-codex-section"><small>ID · ${ITEMXCore.esc(monster.id)}</small></section></div>`;
  }

  function rootBadgeHtml() {
    const update = runtime.update.available ? `<span class="itemx2-update-indicator" x-itemx2-update="${ITEMXCore.esc(runtime.update.latest)}" aria-label="ITEMX 업데이트 가능">↑</span>` : '';
    return `<div class="itemx2-native-badge" x-itemx2-badge="launcher" aria-label="ITEMX"><img src="${ITEMX_BADGE_ICON}" alt="ITEMX">${update}</div><div class="itemx2-aux-status ${runtime.auxActive > 0 ? 'itemx2-aux-status-on' : ''}" aria-live="polite"><i></i><span class="itemx2-aux-status-label">${ITEMXCore.esc(runtime.auxLabel)}</span></div><div class="itemx2-feedback" role="status" aria-live="polite"></div>`;
  }

  const updateLabelHtml = () => runtime.update.available ? `<span class="itemx2-update-label" x-itemx2-update="${ITEMXCore.esc(runtime.update.latest)}">UPDATE</span>` : '';

  function rootInventoryHtml(loaded, open = true, tab = 'inventory') {
    if (!open) return rootBadgeHtml();
    const all = itemsOf(loaded.snapshot).slice(0, 60);
    const pageCount = Math.max(1, Math.ceil(all.length / ITEMX_ROOT_PAGE_SIZE));
    runtime.rootItemPage = Math.max(0, Math.min(pageCount - 1, runtime.rootItemPage));
    const pageStart = runtime.rootItemPage * ITEMX_ROOT_PAGE_SIZE;
    const inventoryPage = tab === 'inventory' ? all.slice(pageStart, pageStart + ITEMX_ROOT_PAGE_SIZE) : [];
    const skills = (loaded.codexSnapshot?.skills?.order || []).map((id) => loaded.codexSnapshot.skills.entries[id]).filter(Boolean).slice(0, 60);
    const monsters = (loaded.codexSnapshot?.monsters?.order || []).map((id) => loaded.codexSnapshot.monsters.entries[id]).filter(Boolean).slice(0, 60);
    const counts = {
      all: all.length, owned: all.filter((item) => item.possession === 'owned').length,
      equipped: all.filter((item) => item.location === 'equipped').length,
      observed: all.filter((item) => item.possession === 'observed').length,
      removed: all.filter((item) => item.possession === 'removed').length
    };
    const filters = [['all', '전체'], ['owned', '보유'], ['equipped', '장착'], ['observed', '관찰'], ['removed', '소실']];
    const controls = tab === 'inventory' ? filters.map(([key]) => `<input class="itemx2-root-control itemx2-root-filter-${key}" id="itemx2-filter-${key}" name="itemx2-filter" type="radio" ${key === 'all' ? 'checked' : ''}>`).join('') : '';
    const skillList = tab === 'skills' ? (skills.map((skill, index) => `<div class="itemx2-codex-entry"><input class="itemx2-root-control itemx2-codex-entry-choice" id="itemx2-skill-${index}" name="itemx2-skill-detail" type="radio"><label class="itemx2-codex-card itemx2-codex-summary itemx2-skill-card" for="itemx2-skill-${index}">${skillSummaryHtml(skill)}</label>${skillPageHtml(skill, '<label class="itemx-codex-back" for="itemx2-skill-none">‹ 스킬 목록</label>')}</div>`).join('') || '<div class="itemx2-codex-empty">아직 확정된 스킬이 없답니다.</div>') : '';
    const monsterList = tab === 'bestiary' ? (monsters.map((monster, index) => {
      const portrait = loaded.portraits?.[monster.portrait] || '';
      return `<div class="itemx2-codex-entry"><input class="itemx2-root-control itemx2-codex-entry-choice" id="itemx2-monster-${index}" name="itemx2-monster-detail" type="radio"><label class="itemx2-codex-card itemx2-codex-summary itemx2-bestiary-card ${monster.active ? 'active' : ''}" for="itemx2-monster-${index}">${monsterSummaryHtml(monster, portrait)}</label>${monsterPageHtml(monster, portrait, '<label class="itemx-codex-back" for="itemx2-monster-none">‹ 조우 목록</label>')}</div>`;
    }).join('') || '<div class="itemx2-codex-empty">실제 전투나 합의된 대련이 발생하면 등록된답니다.</div>') : '';
    const list = tab === 'inventory' ? (inventoryPage.map((item, index) => {
      const detailId = `itemx2-detail-${index}`;
      const tile = ITEMXRenderer.renderTile(item).replace(/^<button\b/, '<span').replace(/<\/button>$/, '</span>');
      const classes = [item.possession === 'owned' && 'itemx2-match-owned', item.location === 'equipped' && 'itemx2-match-equipped', item.possession === 'observed' && 'itemx2-match-observed', item.possession === 'removed' && 'itemx2-match-removed'].filter(Boolean).join(' ');
      return `<div class="itemx2-root-item ${classes}"><input class="itemx2-root-control itemx2-root-detail-choice" id="${detailId}" name="itemx2-detail" type="radio"><label class="itemx2-root-tile-label itemx2-root-tile-${index}" for="${detailId}">${tile}</label><div class="itemx2-root-detail itemx-body"><label class="itemx-back itemx2-root-back" for="itemx2-detail-none">‹ 목록으로</label><div class="itemx-detail itemx2-root-detail-body-${index}"><span class="itemx2-detail-loading">상세 정보를 불러오는 중…</span></div></div></div>`;
    }).join('') || '<div class="itemx2-root-empty">표시할 아이템이 없답니다.</div>') : '';
    const enabled = loaded.enabled === true;
    const positionChoices = tab === 'settings' ? BADGE_POSITIONS.map(([key, label]) => `<button class="itemx2-position-choice itemx2-position-${key} ${runtime.badgePosition === key ? 'itemx2-position-on' : ''}" type="button">${label}</button>`).join('') : '';
    const managerRows = tab === 'settings' ? (all.map((item, index) => `<div class="itemx2-manager-row"><span class="itemx2-manager-name"><strong>${ITEMXCore.esc(item.emoji || '❔')} ${ITEMXCore.esc(item.name)}</strong><small>${ITEMXCore.esc(item.displayRarity || item.rarity)} · ${ITEMXCore.esc(item.possession)} / ${ITEMXCore.esc(item.location)}</small></span><span class="itemx2-manager-actions"><button class="itemx2-manager-reroll-${index}" type="button">재감정</button><button class="itemx2-manager-remove itemx2-manager-remove-${index}" type="button" ${item.possession === 'removed' ? 'disabled' : ''}>제거</button></span></div>`).join('') || '<div class="itemx2-root-empty">관리할 아이템이 없습니다.</div>') : '';
    const manager = `<details class="itemx2-manager-fold"><summary>아이템 관리 <small>현재 화면에서 접기·펼치기</small></summary><div class="itemx2-manager-body"><label class="itemx2-manager-label">수정 지시 · 비워두면 순수 재감정<div class="itemx2-manager-editor itemx2-manager-note" contenteditable="true" role="textbox" aria-label="아이템 수정 지시"></div></label><div class="itemx2-manager-list">${managerRows}</div><div class="itemx2-manager-create"><label class="itemx2-manager-label">신규 아이템 생성 지시<div class="itemx2-manager-editor itemx2-manager-create-note" contenteditable="true" role="textbox" aria-label="신규 아이템 생성 지시"></div></label><button class="itemx2-root-setting-button itemx2-manager-create-button" type="button">＋ 신규 아이템 생성</button></div></div></details>`;
    const connection = connectionSummary();
    const chips = [['hook', connection.hook], ['dom', connection.dom], ['listener', connection.listener]].map(([key, [label, tone]]) => `<i class="itemx2-status-chip itemx2-status-chip-${tone} itemx2-connection-${key}">${label}</i>`).join('');
    const domainControls = [['items', '무기·아이템', loaded.itemsEnabled, '감정·손상·소실'], ['skills', '스킬', loaded.skillsEnabled, '습득·숙련·봉인'], ['encounters', '전투 도감', loaded.encountersEnabled, '적대·대련·전투']].map(([key, label, value, note]) => `<button class="itemx2-domain-card itemx2-setting-domain-${key} ${value ? 'itemx2-setting-on' : ''}" type="button"><strong>${label} · ${value ? 'ON' : 'OFF'}</strong><small>${note}</small></button>`).join('');
    const debugLog = runtime.debugEntries.slice(-12).reverse().map((entry) => `${new Date(entry.at).toLocaleTimeString('ko-KR', { hour12: false })} ${entry.where}\n${entry.detail}`).join('\n\n') || '기록 없음';
    const debugPanel = `<details class="itemx2-manager-fold itemx2-debug-fold"><summary>디버그 진단 <small>${loaded.debugEnabled ? 'ON · 최근 30건' : 'OFF'}</small></summary><div class="itemx2-debug-body"><button class="itemx2-root-setting-button itemx2-setting-debug ${loaded.debugEnabled ? 'itemx2-setting-on' : ''}" type="button">로그 ${loaded.debugEnabled ? 'ON' : 'OFF'}</button><div class="itemx2-debug-grid"><b>문맥</b><span>${ITEMXCore.esc(loaded.key)}</span><b>세대</b><span>${runtime.generation}</span><b>스냅숏</b><span>${ITEMXCore.esc(loaded.snapshot.fingerprint || '-')} / ${ITEMXCore.esc(loaded.codexSnapshot.fingerprint || '-')}</span><b>항목</b><span>${counts.all} / ${skills.length} / ${monsters.length}</span><b>마지막 오류</b><span>${ITEMXCore.esc(runtime.lastHookError || runtime.lastDomError || '없음')}</span></div><pre class="itemx2-debug-log">${ITEMXCore.esc(debugLog)}</pre><button class="itemx2-root-setting-button itemx2-setting-debug-clear" type="button">로그 비우기</button></div></details>`;
    const settings = `<div class="itemx2-root-settings"><section class="itemx2-root-setting-card"><span><strong>연결 및 권한</strong><small>첫 연결에서는 Risu가 모델 처리와 화면 접근 권한을 각각 물을 수 있습니다.</small><span class="itemx2-status-row">${chips}</span></span><button class="itemx2-root-setting-button itemx2-root-setting-button-primary itemx2-setting-connect ${runtime.connectionBusy ? 'itemx2-root-setting-button-busy' : ''}">${runtime.connectionBusy ? '확인 중…' : connection.ready ? '다시 확인' : '연결하기'}</button></section><section class="itemx2-root-setting-card"><span><strong>보조 모델 상태</strong><small class="itemx2-aux-setting-status">${ITEMXCore.esc(auxStatusText())}</small></span><button class="itemx2-root-setting-button itemx2-setting-aux-run" ${runtime.auxActive > 0 ? 'disabled' : ''}>${runtime.auxActive > 0 ? '처리 중…' : '지금 검사'}</button></section><section class="itemx2-root-setting-card"><span><strong>기능별 추적</strong><small>OFF는 새 수집만 멈추며 기존 기록은 보존합니다.</small></span></section><div class="itemx2-domain-grid">${domainControls}</div><section class="itemx2-root-setting-card"><span><strong>사이드 배지 위치</strong><small>선택 즉시 배지와 패널이 이동하고 저장됩니다.</small></span></section><div class="itemx2-position-grid">${positionChoices}</div>${manager}<section class="itemx2-root-setting-card"><span><strong>현재 봇 ITEMX</strong><small>${enabled ? '활성 상태입니다.' : '현재 봇에서 비활성 상태입니다.'}</small></span><button class="itemx2-root-setting-button itemx2-setting-toggle">${enabled ? 'ON' : 'OFF'}</button></section><section class="itemx2-root-setting-card"><span><strong>메인 출력</strong><small>메인 모델에 활성화된 기능의 규약만 주입합니다.</small></span><button class="itemx2-root-setting-button itemx2-setting-main">${loaded.mainOutput ? 'ON' : 'OFF'}</button></section><section class="itemx2-root-setting-card"><span><strong>보조 출력</strong><small>활성화된 기능만 자동 검사합니다. 수동 재감정은 아이템 기능을 사용합니다.</small></span><button class="itemx2-root-setting-button itemx2-setting-aux">${AUX_LABELS[loaded.auxOutput] || AUX_LABELS.missing}</button></section><section class="itemx2-root-setting-card"><span><strong>등급 기준</strong><small>세계관 등급명은 보존하고 ITEMX 내부 효과 등급의 판정 기준을 선택합니다.</small></span><button class="itemx2-root-setting-button itemx2-setting-rarity ${loaded.rarityMode === 'itemx' ? 'itemx2-setting-on' : ''}">${RARITY_MODE_LABELS[loaded.rarityMode] || RARITY_MODE_LABELS.world}</button></section><section class="itemx2-root-setting-card"><span><strong>채팅 저장소</strong><small>${counts.all}개 · ${ITEMXCore.esc(runtime.status)}</small></span><button class="itemx2-root-setting-button itemx2-setting-rebuild">재구축</button></section>${debugPanel}<section class="itemx2-root-setting-card"><span><strong>플러그인</strong><small>ITEMX ${ITEMX_PLUGIN_VERSION}</small></span></section></div>`;
    const pager = pageCount > 1 ? `<span class="itemx2-root-pager"><button class="itemx2-root-page-prev" type="button" ${runtime.rootItemPage === 0 ? 'disabled' : ''}>‹</button><b>${runtime.rootItemPage + 1} / ${pageCount}</b><button class="itemx2-root-page-next" type="button" ${runtime.rootItemPage >= pageCount - 1 ? 'disabled' : ''}>›</button></span>` : '';
    const shownEnd = Math.min(all.length, pageStart + inventoryPage.length);
    const inventoryContent = `<div class="itemx2-root-inventory"><nav class="itemx-seg itemx2-root-filters">${filters.map(([key, label]) => `<label class="itemx-seg-i" for="itemx2-filter-${key}">${label} <span class="itemx-seg-n">${counts[key]}</span></label>`).join('')}</nav><div class="itemx-tools itemx2-root-tools"><span class="itemx-tool">✦ 속성 효과</span><span class="itemx-search">채팅별 저장소</span></div><div class="itemx-body"><div class="itemx-grid">${list}</div></div><footer class="itemx-pf"><span>${all.length ? `${pageStart + 1}-${shownEnd}` : '0'} / ${all.length}점${itemsOf(loaded.snapshot).length > 60 ? ' · 첫 60점' : ''}</span>${pager}</footer></div>`;
    const skillsContent = `<div class="itemx2-root-skills itemx2-root-tab-active"><input class="itemx2-root-control" id="itemx2-skill-none" name="itemx2-skill-detail" type="radio" checked><div class="itemx2-codex-note">장착·봉인·본문에서 다시 언급된 스킬만 모델 문맥에 제한적으로 전달됩니다.</div>${skillList}</div>`;
    const bestiaryContent = `<div class="itemx2-root-bestiary itemx2-root-tab-active"><input class="itemx2-root-control" id="itemx2-monster-none" name="itemx2-monster-detail" type="radio" checked><div class="itemx2-codex-note">단순 등장인물 목록이 아니라 실제 적대·전투·합의된 대련만 기록합니다.</div>${monsterList}</div>`;
    const activeContent = tab === 'skills' ? skillsContent : tab === 'bestiary' ? bestiaryContent : tab === 'settings' ? settings : inventoryContent;
    const tabs = [['inventory', '인벤'], ['skills', '스킬'], ['bestiary', '조우 도감'], ['settings', '설정']].map(([key, label]) => `<button class="itemx-main-tab itemx2-root-tab-${key} ${tab === key ? 'itemx-main-tab-on' : ''}" type="button">${label}</button>`).join('');
    return `${controls}${rootBadgeHtml()}<div class="itemx2-root-layer"><section class="itemx-panel itemx2-root-panel" aria-label="ITEMX 인벤토리"><input class="itemx2-root-control" id="itemx2-detail-none" name="itemx2-detail" type="radio" checked><header class="itemx-ph"><span class="itemx-ph-text"><span class="itemx-ph-eyebrow">ITEMX · ${ITEMX_VERSION_LABEL}${updateLabelHtml()}</span><span class="itemx-ph-title">${ITEMXCore.esc(loaded.character.name || '인벤토리')}</span><span class="itemx-ph-sub">${enabled ? `보유 ${counts.owned} · 장착 ${counts.equipped} · 관찰 ${counts.observed}` : '현재 봇 비활성'} · ${ITEMXCore.esc(runtime.status)}</span></span><button class="itemx-ph-btn itemx2-root-close" type="button" aria-label="닫기">✕</button></header><nav class="itemx-main-tabs">${tabs}</nav><div class="itemx2-root-tab-body">${activeContent}</div></section></div>`;
  }

  const rootStateFingerprint = (loaded) => [loaded.snapshot?.fingerprint, loaded.codexSnapshot?.fingerprint, Number(loaded.enabled), Number(loaded.itemsEnabled), Number(loaded.skillsEnabled), Number(loaded.encountersEnabled), Number(loaded.mainOutput), loaded.auxOutput, loaded.rarityMode, Number(loaded.debugEnabled)].join(':');

  async function installNativeBadgeClick(owner) {
    if (runtime.badgeEventOwner || !owner) return;
    runtime.badgeEventOwner = owner;
    runtime.badgeEventId = await owner.addEventListener('click', async (event) => {
      try {
        const badge = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-native-badge');
        if (!badge) return;
        const rect = await badge.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
        const loaded = await cachedOrRebuildCurrent();
        if (!loaded) return;
        loaded.enabled = await isEnabled(loaded.character); Object.assign(loaded, await outputSettings(loaded.character));
        const fingerprint = rootStateFingerprint(loaded);
        if (!runtime.rootContentReady || runtime.rootFingerprint !== fingerprint || !(await setRootOpen(true))) await openRootInventory({ open: true, loaded, tab: runtime.activeRootTab });
      } catch (error) { fail('native badge click', error); }
    });
    await owner.addEventListener('click', async (event) => {
      try {
        const close = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-root-close');
        if (close) {
          const closeRect = await close.getBoundingClientRect();
          if (event.clientX >= closeRect.left && event.clientX <= closeRect.right && event.clientY >= closeRect.top && event.clientY <= closeRect.bottom) {
            await setRootOpen(false);
            return;
          }
        }
        for (const [tab, label] of [['inventory', '인벤토리'], ['skills', '스킬'], ['bestiary', '조우 도감'], ['settings', '설정']]) {
          const button = runtime.mainDoc && await runtime.mainDoc.querySelector(`.x-risu-itemx2-root-tab-${tab}`);
          if (!button) continue;
          const rect = await button.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) continue;
          if (runtime.rootTabBusy || runtime.activeRootTab === tab) return;
          runtime.rootTabBusy = true;
          try {
            if (tab === 'inventory') runtime.rootItemPage = 0;
            const body = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-root-tab-body');
            if (body) await body.setInnerHTML(`<div class="itemx2-tab-loading" role="status" aria-live="polite"><i></i><strong>${label} 불러오는 중</strong><small>선택한 탭만 준비하고 있답니다.</small></div>`);
            await delay(24);
            await openRootInventory({ open: true, tab });
          } finally { runtime.rootTabBusy = false; }
          return;
        }
        for (const [direction, selector] of [[-1, '.x-risu-itemx2-root-page-prev'], [1, '.x-risu-itemx2-root-page-next']]) {
          const button = runtime.mainDoc && await runtime.mainDoc.querySelector(selector);
          if (!button) continue;
          const rect = await button.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) continue;
          if (runtime.rootTabBusy) return;
          const loaded = await cachedOrRebuildCurrent();
          if (!loaded) return;
          const pageCount = Math.max(1, Math.ceil(Math.min(60, itemsOf(loaded.snapshot).length) / ITEMX_ROOT_PAGE_SIZE));
          const nextPage = Math.max(0, Math.min(pageCount - 1, runtime.rootItemPage + direction));
          if (nextPage === runtime.rootItemPage) return;
          runtime.rootItemPage = nextPage;
          runtime.rootTabBusy = true;
          try {
            const body = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-root-tab-body');
            if (body) await body.setInnerHTML('<div class="itemx2-tab-loading" role="status" aria-live="polite"><i></i><strong>아이템 불러오는 중</strong><small>16개씩 나누어 준비하고 있답니다.</small></div>');
            await delay(24);
            await openRootInventory({ open: true, tab: 'inventory', loaded });
          } finally { runtime.rootTabBusy = false; }
          return;
        }
        const managerFold = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-manager-fold');
        if (managerFold) {
          const foldRect = await managerFold.getBoundingClientRect();
          const insideManager = event.clientX >= foldRect.left && event.clientX <= foldRect.right && event.clientY >= foldRect.top && event.clientY <= foldRect.bottom;
          if (insideManager) {
            const loaded = await rebuildCurrent();
            if (loaded) {
              const managedItems = itemsOf(loaded.snapshot).slice(0, 60);
              const noteElement = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-manager-note');
              const note = (await noteElement?.textContent())?.trim() || '';
              for (let index = 0; index < managedItems.length; index += 1) {
                const target = managedItems[index];
                const reroll = runtime.mainDoc && await runtime.mainDoc.querySelector(`.x-risu-itemx2-manager-reroll-${index}`);
                if (reroll) {
                  const rect = await reroll.getBoundingClientRect();
                  if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
                    runtime.status = note ? '정보 수정 감정 중' : '아이템 재감정 중';
                    try {
                      const itemEvent = await runItemModel('reroll', loaded, target, note);
                      await commitManualEvents(loaded, [itemEvent], note ? '정보 수정' : '재감정');
                    } catch (error) {
                      runtime.status = '재감정 실패';
                      if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX: ${error.message || error}`);
                    }
                    await openRootInventory({ open: true, tab: 'settings' });
                    return;
                  }
                }
                const remove = runtime.mainDoc && await runtime.mainDoc.querySelector(`.x-risu-itemx2-manager-remove-${index}`);
                if (remove) {
                  const rect = await remove.getBoundingClientRect();
                  if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
                    if (target.possession === 'removed') return;
                    if (typeof Risuai.alertConfirm === 'function' && !(await Risuai.alertConfirm(`${target.name}을(를) 현재 채팅 인벤토리에서 제거할까요?`))) return;
                    const itemEvent = { kind: 'patch', patch: { id: target.id, action: null, op: 'remove', fields: {}, quantity: null, destination: '', reason: 'manual_remove', slot: null, inputs: null, outputs: null, equip: null, unequip: null } };
                    try { await commitManualEvents(loaded, [itemEvent], '수동 제거'); }
                    catch (error) { runtime.status = '수동 제거 실패'; if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX: ${error.message || error}`); }
                    await openRootInventory({ open: true, tab: 'settings' });
                    return;
                  }
                }
              }
              const create = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-manager-create-button');
              if (create) {
                const rect = await create.getBoundingClientRect();
                if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
                  const createNoteElement = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-manager-create-note');
                  const createNote = (await createNoteElement?.textContent())?.trim() || '';
                  if (!createNote) { if (typeof Risuai.alertError === 'function') await Risuai.alertError('ITEMX: 생성할 아이템 설명을 입력하세요.'); return; }
                  runtime.status = '신규 아이템 생성 중';
                  try {
                    const itemEvent = await runItemModel('create', loaded, null, createNote);
                    await commitManualEvents(loaded, [itemEvent], '신규 생성');
                  } catch (error) {
                    runtime.status = '아이템 생성 실패';
                    if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX: ${error.message || error}`);
                  }
                  await openRootInventory({ open: true, tab: 'settings' });
                  return;
                }
              }
            }
          }
        }
        const connect = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-connect');
        if (connect) {
          const rect = await connect.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            if (runtime.connectionBusy) return;
            runtime.connectionBusy = true;
            runtime.status = '연결 및 권한 확인 중';
            await updateConnectionUi();
            await showRootFeedback('ITEMX 연결과 권한을 확인하는 중입니다…', 'working', 0);
            try {
              const connected = await installPipelineHooks({ prompt: true });
              const styled = await installMainStyle();
              runtime.status = connected && styled ? '연결 및 권한 정상' : connected ? '화면 연결 실패' : '모델 훅 연결 실패';
              if (connected && styled) {
                await showRootFeedback('ITEMX 연결 및 권한 확인 완료', 'success');
              } else {
                await showRootFeedback(`연결 확인 실패 · ${(!connected ? runtime.lastHookError : runtime.lastDomError) || runtime.status}`, 'error', 3600);
              }
              if ((!connected || !styled) && typeof Risuai.alertError === 'function') {
                await Risuai.alertError(`ITEMX 연결 확인 실패: ${(!connected ? runtime.lastHookError : runtime.lastDomError) || runtime.status}`);
              }
            } finally {
              runtime.connectionBusy = false;
              await updateConnectionUi();
            }
            return;
          }
        }
        const auxRun = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-aux-run');
        if (auxRun) {
          const rect = await auxRun.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            if (runtime.auxActive > 0) return;
            runtime.status = '보조 모델 수동 검사 중';
            await recoverAuxiliaryOutput({ force: true });
            return;
          }
        }
        for (const [key, label] of BADGE_POSITIONS) {
          const choice = runtime.mainDoc && await runtime.mainDoc.querySelector(`.x-risu-itemx2-position-${key}`);
          if (!choice) continue;
          const rect = await choice.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) continue;
          runtime.badgePosition = key;
          await Risuai.pluginStorage.setItem('badgePosition', key);
          runtime.status = `배지 위치 · ${label}`;
          if (runtime.rootDrawer) {
            for (const [other] of BADGE_POSITIONS) await runtime.rootDrawer.removeClass(`x-risu-itemx2-pos-${other}`);
            await runtime.rootDrawer.addClass(`x-risu-itemx2-pos-${key}`);
          }
          await installMainStyle();
          for (const [other] of BADGE_POSITIONS) {
            const button = runtime.mainDoc && await runtime.mainDoc.querySelector(`.x-risu-itemx2-position-${other}`);
            if (!button) continue;
            if (other === key) await button.addClass('x-risu-itemx2-position-on');
            else await button.removeClass('x-risu-itemx2-position-on');
          }
          return;
        }
        const toggle = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-toggle');
        if (toggle) {
          const rect = await toggle.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            await applyRootSetting(async () => {
              const loaded = await rebuildCurrent();
              if (!loaded) return;
              const next = !(await isEnabled(loaded.character));
              await setEnabled(loaded.character, next);
              runtime.status = next ? '현재 봇 활성화' : '현재 봇 비활성화';
              await updateRootSettingButton('.x-risu-itemx2-setting-toggle', next ? 'ON' : 'OFF', next);
            });
            return;
          }
        }
        const main = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-main');
        for (const [domain, key, label] of [['items', 'itemsEnabled', '무기·아이템'], ['skills', 'skillsEnabled', '스킬'], ['encounters', 'encountersEnabled', '전투 도감']]) {
          const button = runtime.mainDoc && await runtime.mainDoc.querySelector(`.x-risu-itemx2-setting-domain-${domain}`);
          if (!button) continue;
          const rect = await button.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) continue;
          await applyRootSetting(async () => {
            const loaded = await rebuildCurrent(); if (!loaded) return;
            const current = await outputSettings(loaded.character), value = !current[key];
            await setDomainEnabled(loaded.character, domain, value);
            runtime.cachedLoaded = null; runtime.status = `${label} · ${value ? 'ON' : 'OFF'}`;
            await openRootInventory({ open: true, tab: 'settings' });
          });
          return;
        }
        const debug = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-debug');
        if (debug) {
          const rect = await debug.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            await applyRootSetting(async () => {
              const loaded = await rebuildCurrent(); if (!loaded) return;
              const value = !(await outputSettings(loaded.character)).debugEnabled;
              await setDebugEnabled(loaded.character, value); runtime.cachedLoaded = null; runtime.status = `디버그 로그 · ${value ? 'ON' : 'OFF'}`;
              await openRootInventory({ open: true, tab: 'settings' });
            });
            return;
          }
        }
        const debugClear = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-debug-clear');
        if (debugClear) {
          const rect = await debugClear.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            runtime.debugEntries = []; runtime.status = '디버그 로그 비움';
            await openRootInventory({ open: true, tab: 'settings' }); return;
          }
        }
        if (main) {
          const rect = await main.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            await applyRootSetting(async () => {
              const loaded = await rebuildCurrent();
              if (!loaded) return;
              const value = !(await outputSettings(loaded.character)).mainOutput;
              await setMainOutput(loaded.character, value);
              runtime.status = `메인 출력 · ${value ? 'ON' : 'OFF'}`;
              await updateRootSettingButton('.x-risu-itemx2-setting-main', value ? 'ON' : 'OFF', value);
            });
            return;
          }
        }
        const aux = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-aux');
        if (aux) {
          const rect = await aux.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            await applyRootSetting(async () => {
              const loaded = await rebuildCurrent();
              if (!loaded) return;
              const current = (await outputSettings(loaded.character)).auxOutput;
              const value = current === 'missing' ? 'always' : current === 'always' ? 'off' : 'missing';
              await setAuxOutput(loaded.character, value);
              runtime.status = `보조 출력 · ${AUX_LABELS[value]}`;
              await updateRootSettingButton('.x-risu-itemx2-setting-aux', AUX_LABELS[value], value !== 'off');
            });
            return;
          }
        }
        const rarity = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-rarity');
        if (rarity) {
          const rect = await rarity.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            await applyRootSetting(async () => {
              const loaded = await rebuildCurrent();
              if (!loaded) return;
              const current = (await outputSettings(loaded.character)).rarityMode;
              const value = current === 'itemx' ? 'world' : 'itemx';
              await setRarityMode(loaded.character, value);
              runtime.status = `등급 기준 · ${RARITY_MODE_LABELS[value]}`;
              await updateRootSettingButton('.x-risu-itemx2-setting-rarity', RARITY_MODE_LABELS[value], value === 'itemx');
            });
            return;
          }
        }
        const rebuild = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-rebuild');
        if (rebuild) {
          const rect = await rebuild.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) await openRootInventory({ open: true, tab: 'settings' });
        }
      } catch (error) { fail('native setting click', error); }
    });
  }

  async function openRootInventory(options = {}) {
    return enqueue('ui:root-drawer', () => openRootInventoryNow(options));
  }

  async function openRootInventoryNow({ open = true, tab = 'inventory', loaded: suppliedLoaded = null } = {}) {
    try {
      runtime.panelOpen = false;
      try { await Risuai.hideContainer(); } catch {}
      const loaded = suppliedLoaded || await cachedOrRebuildCurrent();
      if (!loaded) throw new Error('No active chat context');
      if (runtime.activeContextKey && runtime.activeContextKey !== loaded.key) return;
      loaded.enabled = await isEnabled(loaded.character);
      Object.assign(loaded, await outputSettings(loaded.character));
      runtime.debugEnabled = loaded.debugEnabled;
      loaded.portraits = tab === 'bestiary' && loaded.encountersEnabled ? await loadCodexPortraits(loaded.character, loaded.codexSnapshot) : {};
      const styled = await installMainStyle({ prompt: true });
      if (!styled || !runtime.mainDoc) {
        runtime.status = '메인 화면 권한 필요';
        if (typeof Risuai.alertError === 'function') await Risuai.alertError('ITEMX 인벤토리를 열려면 메인 화면 권한이 필요합니다.');
        return;
      }
      await removeRootDrawer();
      const root = await runtime.mainDoc.createElement('div');
      await root.setAttribute('x-itemx2-drawer', 'owner');
      await root.setClassName(`x-risu-itemx2-root-drawer x-risu-itemx2-pos-${runtime.badgePosition}${open ? ' x-risu-itemx2-is-open' : ''}`);
      await root.setInnerHTML(rootInventoryHtml(loaded, open, tab));
      const body = await runtime.mainDoc.querySelector('body');
      if (!body) throw new Error('Main document body unavailable');
      if (runtime.activeContextKey !== loaded.key) return;
      await body.appendChild(root);
      if (runtime.activeContextKey !== loaded.key) { await root.remove(); return; }
      runtime.rootDrawer = root;
      runtime.rootFingerprint = rootStateFingerprint(loaded);
      runtime.rootContentReady = open;
      runtime.activeRootTab = tab;
      await installNativeBadgeClick(root);
      if (open && tab === 'inventory') await installRootItemDetailClicks(loaded);
    } catch (error) {
      runtime.status = '인벤토리 열기 오류';
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
    return !q || [item.name, item.id, item.itemType, item.displayRarity, item.affinity, item.affinity2].some((value) => String(value || '').toLowerCase().includes(q));
  }

  function drawInventory(loaded) {
    const root = document.querySelector('#itemx2-root');
    if (!root) return;
    const all = itemsOf(loaded.snapshot), selected = ui.selected && all.find((item) => item.id === ui.selected);
    const counts = {
      all: all.length, owned: all.filter((item) => item.possession === 'owned').length,
      equipped: all.filter((item) => item.location === 'equipped').length,
      observed: all.filter((item) => item.possession === 'observed').length,
      removed: all.filter((item) => item.possession === 'removed').length
    };
    const visible = ui.tab === 'inventory' ? all.filter(matches).slice(0, 60) : [];
    if (ui.tab === 'settings' && (!ui.manageId || !all.some((item) => item.id === ui.manageId))) ui.manageId = all.find((item) => item.possession !== 'removed')?.id || all[0]?.id || null;
    const managed = ui.tab === 'settings' && ui.manageId ? all.find((item) => item.id === ui.manageId) : null;
    const manageOptions = ui.tab === 'settings' ? all.map((item) => `<option value="${ITEMXCore.esc(item.id)}" ${item.id === ui.manageId ? 'selected' : ''}>${ITEMXCore.esc(item.emoji || '❔')} ${ITEMXCore.esc(item.name)} · ${ITEMXCore.esc(item.id)}</option>`).join('') : '';
    const enabled = loaded.enabled === true;
    const inventoryContent = !enabled
      ? `<div class="itemx-disabled"><strong>현재 봇에서 ITEMX가 꺼져 있답니다.</strong><span>설정 탭에서 다시 활성화할 수 있습니다.</span><button class="itemx-tool" data-tab="settings">설정 열기</button></div>`
      : (selected ? `<div class="itemx-body"><button class="itemx-back" data-action="back">‹ 목록으로</button><div class="itemx-detail">${ITEMXRenderer.renderCard(selected, { motion: ui.motion ? 'full' : 'off' })}</div></div>` : `<nav class="itemx-seg">${[['all', '전체'], ['owned', '보유'], ['equipped', '장착'], ['observed', '관찰'], ['removed', '소실']].map(([key, label]) => `<button class="itemx-seg-i ${ui.filter === key ? 'itemx-seg-on' : ''}" data-filter="${key}">${label} <span class="itemx-seg-n">${counts[key]}</span></button>`).join('')}</nav><div class="itemx-tools"><button class="itemx-tool" data-action="motion">${ui.motion ? '✦ 모션' : '◇ 정지'}</button><input class="itemx-search itemx-search-input" value="${ITEMXCore.esc(ui.query)}" placeholder="검색" aria-label="검색"><button class="itemx-tool" data-action="rebuild">↻</button></div><div class="itemx-body"><div class="itemx-grid">${visible.map(ITEMXRenderer.renderTile).join('') || '<div class="itemx-empty">표시할 아이템이 없답니다.</div>'}</div></div><footer class="itemx-pf">${visible.length}점 표시${all.filter(matches).length > 60 ? ' · 첫 60점' : ''}</footer>`);
    const permissionLabel = runtime.permissions.replacer === true ? '연결됨' : runtime.permissions.replacer === false ? '권한 필요' : '확인 중';
    const styleLabel = runtime.permissions.mainDom === true ? '고정 스타일' : runtime.permissions.mainDom === false ? '본문 폴백' : '확인 중';
    const positionOptions = BADGE_POSITIONS.map(([value, label]) => `<option value="${value}" ${runtime.badgePosition === value ? 'selected' : ''}>${label}</option>`).join('');
    const managerContent = `<section class="itemx-manager"><div class="itemx-manager-title">아이템 운영 도구</div><label class="itemx-manager-field"><span>대상 아이템</span><select data-action="manage-select" ${all.length ? '' : 'disabled'}>${manageOptions || '<option>아이템 없음</option>'}</select></label><label class="itemx-manager-field"><span>수정 지시 · 비워두면 순수 재감정</span><textarea data-action="manage-note" placeholder="예: 이름은 그대로 두고 내구도를 31/100으로, 화염 속성은 제거"></textarea></label><div class="itemx-manager-actions"><button class="itemx-tool" data-action="manage-reroll" ${managed ? '' : 'disabled'}>🔄 정보 수정·재감정</button><button class="itemx-tool itemx-manager-danger" data-action="manage-remove" ${managed && managed.possession !== 'removed' ? '' : 'disabled'}>🗑 수동 제거</button></div><div class="itemx-manager-current">${managed ? `${ITEMXCore.esc(managed.name)} · ${ITEMXCore.esc(managed.displayRarity || managed.rarity)} · ${ITEMXCore.esc(managed.possession)} / ${ITEMXCore.esc(managed.location)}` : '선택 가능한 아이템이 없습니다.'}</div><label class="itemx-manager-field"><span>신규 아이템 생성 지시</span><textarea data-action="create-note" placeholder="예: 주인공이 획득한 번개 속성의 희귀 장검"></textarea></label><button class="itemx-tool" data-action="manage-create">＋ 신규 아이템 생성 시도</button><small class="itemx-manager-help">보조 모델 결과는 ITEMX 엄격 파서와 id 검증을 통과한 경우에만 채팅별 사건 원장에 반영됩니다.</small></section>`;
    const domainControls = [['items', '무기·아이템', loaded.itemsEnabled], ['skills', '스킬', loaded.skillsEnabled], ['encounters', '전투 도감', loaded.encountersEnabled]].map(([key, label, value]) => `<button class="itemx-tool ${value ? 'itemx-setting-on' : ''}" data-action="domain-${key}">${label} ${value ? 'ON' : 'OFF'}</button>`).join('');
    const debugLog = runtime.debugEntries.slice(-12).reverse().map((entry) => `${new Date(entry.at).toLocaleTimeString('ko-KR', { hour12: false })} ${entry.where}\n${entry.detail}`).join('\n\n') || '기록 없음';
    const debugContent = `<details class="itemx-codex-fold"><summary><strong>디버그 진단 · ${loaded.debugEnabled ? 'ON' : 'OFF'}</strong><small>훅·스냅숏·최근 로그</small></summary><div class="itemx-codex-detail"><span>문맥 ${ITEMXCore.esc(loaded.key)}</span><span>스냅숏 ${ITEMXCore.esc(loaded.snapshot.fingerprint || '-')} / ${ITEMXCore.esc(loaded.codexSnapshot.fingerprint || '-')}</span><span>오류 ${ITEMXCore.esc(runtime.lastHookError || runtime.lastDomError || '없음')}</span><div class="itemx-manager-actions"><button class="itemx-tool ${loaded.debugEnabled ? 'itemx-setting-on' : ''}" data-action="debug-toggle">로그 ${loaded.debugEnabled ? 'ON' : 'OFF'}</button><button class="itemx-tool" data-action="debug-clear">비우기</button></div><pre class="itemx-debug-log">${ITEMXCore.esc(debugLog)}</pre></div></details>`;
    const settingsContent = `<div class="itemx-settings">${managerContent}<section class="itemx-setting-card"><span><strong>기능별 추적</strong><small>OFF는 새 수집만 멈추며 기존 기록은 보존합니다.</small></span></section><div class="itemx-domain-controls">${domainControls}</div><section class="itemx-setting-card"><span><strong>현재 봇 ITEMX</strong><small>${enabled ? '활성 상태입니다.' : '모든 모델 규약과 처리를 멈춥니다.'}</small></span><button class="itemx-tool ${enabled ? 'itemx-setting-on' : ''}" data-action="toggle">${enabled ? 'ON' : 'OFF'}</button></section><section class="itemx-setting-card"><span><strong>메인 출력</strong><small>활성화된 기능의 규약만 주입합니다.</small></span><button class="itemx-tool ${loaded.mainOutput ? 'itemx-setting-on' : ''}" data-action="main-output">${loaded.mainOutput ? 'ON' : 'OFF'}</button></section><section class="itemx-setting-card"><span><strong>보조 출력</strong><small>활성화된 기능만 누락 복구합니다.</small></span><button class="itemx-tool" data-action="aux-output">${AUX_LABELS[loaded.auxOutput] || AUX_LABELS.missing}</button></section><section class="itemx-setting-card"><span><strong>등급 기준</strong><small>세계관 등급명은 보존하고 ITEMX 내부 효과 등급의 판정 기준을 선택합니다.</small></span><button class="itemx-tool ${loaded.rarityMode === 'itemx' ? 'itemx-setting-on' : ''}" data-action="rarity-mode">${RARITY_MODE_LABELS[loaded.rarityMode] || RARITY_MODE_LABELS.world}</button></section><section class="itemx-setting-card"><span><strong>사이드 배지 위치</strong><small>기존 ITEMX 모듈과 같은 여섯 방향 배치입니다.</small></span><select class="itemx-position-select" data-action="badge-position">${positionOptions}</select></section><section class="itemx-setting-card"><span><strong>모델 처리 권한</strong><small>${permissionLabel} · 요청 주입과 원시 태그 정리에 필요합니다.</small></span><button class="itemx-tool" data-action="permissions">권한 요청</button></section><section class="itemx-setting-card"><span><strong>본문 카드 스타일</strong><small>${styleLabel} · 거부되어도 메시지별 스타일로 표시합니다.</small></span><button class="itemx-tool" data-action="style">다시 연결</button></section><section class="itemx-setting-card"><span><strong>채팅 저장소 재구축</strong><small>본문 사건과 수동 사건 원장을 시간순으로 다시 읽습니다.</small></span><button class="itemx-tool" data-action="rebuild">재구축</button></section>${debugContent}<p class="itemx-setting-note">보조 복구는 활성화된 도메인의 검증된 마커만 반영합니다.</p></div>`;
    const iframeSkills = ui.tab === 'skills' ? (loaded.codexSnapshot?.skills?.order || []).map((id) => loaded.codexSnapshot.skills.entries[id]).filter(Boolean) : [];
    const iframeMonsters = ui.tab === 'bestiary' ? (loaded.codexSnapshot?.monsters?.order || []).map((id) => loaded.codexSnapshot.monsters.entries[id]).filter(Boolean) : [];
    const selectedSkill = ui.selectedSkill && iframeSkills.find((one) => one.id === ui.selectedSkill);
    const selectedMonster = ui.selectedMonster && iframeMonsters.find((one) => one.id === ui.selectedMonster);
    const skillRows = iframeSkills.map((one) => `<button class="itemx-codex-list-button itemx2-codex-card itemx2-codex-summary" data-skill-id="${ITEMXCore.esc(one.id)}">${skillSummaryHtml(one)}</button>`).join('');
    const monsterRows = iframeMonsters.map((one) => `<button class="itemx-codex-list-button itemx2-codex-card itemx2-codex-summary itemx2-bestiary-card ${one.active ? 'active' : ''}" data-monster-id="${ITEMXCore.esc(one.id)}">${monsterSummaryHtml(one, loaded.portraits?.[one.portrait] || '')}</button>`).join('');
    const skillsContent = `<div class="itemx-settings">${selectedSkill ? skillPageHtml(selectedSkill, '<button class="itemx-codex-back" data-action="back-skill">‹ 스킬 목록</button>').replace('itemx2-codex-page', 'itemx-codex-page-active') : `<div class="itemx-codex-list">${skillRows || '<div class="itemx-empty">아직 확정된 스킬이 없답니다.</div>'}</div>`}</div>`;
    const bestiaryContent = `<div class="itemx-settings">${selectedMonster ? monsterPageHtml(selectedMonster, loaded.portraits?.[selectedMonster.portrait] || '', '<button class="itemx-codex-back" data-action="back-monster">‹ 조우 목록</button>').replace('itemx2-codex-page', 'itemx-codex-page-active') : `<div class="itemx-codex-list">${monsterRows || '<div class="itemx-empty">실제 전투나 합의된 대련이 발생하면 등록된답니다.</div>'}</div>`}</div>`;
    const content = ui.tab === 'settings' ? settingsContent : ui.tab === 'skills' ? skillsContent : ui.tab === 'bestiary' ? bestiaryContent : inventoryContent;
    root.innerHTML = `<div class="risu-shell"><main class="stage itemx-plugin-stage ${runtime.compactContainer ? '' : 'itemx-plugin-stage-fallback'}"><section class="itemx-panel" aria-label="ITEMX"><header class="itemx-ph"><span class="itemx-ph-text"><span class="itemx-ph-eyebrow">ITEMX · ${ITEMX_VERSION_LABEL}${updateLabelHtml()}</span><span class="itemx-ph-title">${ITEMXCore.esc(loaded.character.name || '인벤토리')}</span><span class="itemx-ph-sub">${enabled ? `보유 ${counts.owned} · 장착 ${counts.equipped} · 관찰 ${counts.observed}` : '현재 봇 비활성'} · ${ITEMXCore.esc(runtime.status)}</span></span><button class="itemx-ph-btn" data-action="close" aria-label="닫기">✕</button></header><nav class="itemx-main-tabs"><button class="itemx-main-tab ${ui.tab === 'inventory' ? 'itemx-main-tab-on' : ''}" data-tab="inventory">인벤</button><button class="itemx-main-tab ${ui.tab === 'skills' ? 'itemx-main-tab-on' : ''}" data-tab="skills">스킬</button><button class="itemx-main-tab ${ui.tab === 'bestiary' ? 'itemx-main-tab-on' : ''}" data-tab="bestiary">조우 도감</button><button class="itemx-main-tab ${ui.tab === 'settings' ? 'itemx-main-tab-on' : ''}" data-tab="settings">설정</button></nav>${content}</section></main></div>`;
    root.querySelector('[data-action="close"]')?.addEventListener('click', () => { void closeInventory(); });
    root.querySelector('[data-action="back"]')?.addEventListener('click', () => { ui.selected = null; drawInventory(loaded); });
    root.querySelector('[data-action="back-skill"]')?.addEventListener('click', () => { ui.selectedSkill = null; drawInventory(loaded); });
    root.querySelector('[data-action="back-monster"]')?.addEventListener('click', () => { ui.selectedMonster = null; drawInventory(loaded); });
    root.querySelector('[data-action="motion"]')?.addEventListener('click', () => { ui.motion = !ui.motion; drawInventory(loaded); });
    root.querySelector('[data-action="toggle"]')?.addEventListener('click', async () => { loaded.enabled = !enabled; await setEnabled(loaded.character, loaded.enabled); runtime.status = loaded.enabled ? '현재 봇 활성화' : '현재 봇 비활성화'; drawInventory(loaded); });
    for (const [domain, key, label] of [['items', 'itemsEnabled', '무기·아이템'], ['skills', 'skillsEnabled', '스킬'], ['encounters', 'encountersEnabled', '전투 도감']]) root.querySelector(`[data-action="domain-${domain}"]`)?.addEventListener('click', async () => {
      loaded[key] = !loaded[key]; await setDomainEnabled(loaded.character, domain, loaded[key]); runtime.status = `${label} · ${loaded[key] ? 'ON' : 'OFF'}`; drawInventory(loaded);
    });
    root.querySelector('[data-action="debug-toggle"]')?.addEventListener('click', async () => { loaded.debugEnabled = !loaded.debugEnabled; await setDebugEnabled(loaded.character, loaded.debugEnabled); runtime.status = `디버그 로그 · ${loaded.debugEnabled ? 'ON' : 'OFF'}`; drawInventory(loaded); });
    root.querySelector('[data-action="debug-clear"]')?.addEventListener('click', () => { runtime.debugEntries = []; runtime.status = '디버그 로그 비움'; drawInventory(loaded); });
    root.querySelector('[data-action="main-output"]')?.addEventListener('click', async () => { loaded.mainOutput = !loaded.mainOutput; await setMainOutput(loaded.character, loaded.mainOutput); runtime.status = `메인 출력 · ${loaded.mainOutput ? 'ON' : 'OFF'}`; drawInventory(loaded); });
    root.querySelector('[data-action="aux-output"]')?.addEventListener('click', async () => { loaded.auxOutput = loaded.auxOutput === 'missing' ? 'always' : loaded.auxOutput === 'always' ? 'off' : 'missing'; await setAuxOutput(loaded.character, loaded.auxOutput); runtime.status = `보조 출력 · ${AUX_LABELS[loaded.auxOutput]}`; drawInventory(loaded); });
    root.querySelector('[data-action="rarity-mode"]')?.addEventListener('click', async () => { loaded.rarityMode = loaded.rarityMode === 'itemx' ? 'world' : 'itemx'; await setRarityMode(loaded.character, loaded.rarityMode); runtime.status = `등급 기준 · ${RARITY_MODE_LABELS[loaded.rarityMode]}`; drawInventory(loaded); });
    root.querySelector('[data-action="rebuild"]')?.addEventListener('click', async () => { const next = await rebuildCurrent(); if (next) { next.enabled = await isEnabled(next.character); drawInventory(next); } });
    root.querySelector('[data-action="permissions"]')?.addEventListener('click', async () => {
      runtime.status = '모델 처리 권한 확인 중'; drawInventory(loaded);
      const connected = await installPipelineHooks({ prompt: true });
      if (connected && typeof Risuai.alert === 'function') await Risuai.alert('ITEMX 모델 처리 권한이 연결되었습니다.');
      else if (!connected && typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX 권한 연결 실패: ${runtime.lastHookError || runtime.status}`);
      const next = await rebuildCurrent(); if (next) { next.enabled = await isEnabled(next.character); drawInventory(next); }
    });
    root.querySelector('[data-action="style"]')?.addEventListener('click', async () => {
      runtime.status = '본문 화면 연결 중'; drawInventory(loaded);
      const styled = await installMainStyle({ prompt: true });
      if (styled && typeof Risuai.alert === 'function') await Risuai.alert('ITEMX 본문 화면 연결이 완료되었습니다.');
      else if (!styled && typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX 화면 연결 실패: ${runtime.lastDomError || runtime.status}`);
      drawInventory(loaded);
    });
    root.querySelector('[data-action="badge-position"]')?.addEventListener('change', async (event) => { const value = event.target.value; if (!BADGE_POSITIONS.some(([key]) => key === value)) return; runtime.badgePosition = value; await Risuai.pluginStorage.setItem('badgePosition', value); if (runtime.rootDrawer) { for (const [other] of BADGE_POSITIONS) await runtime.rootDrawer.removeClass(`x-risu-itemx2-pos-${other}`); await runtime.rootDrawer.addClass(`x-risu-itemx2-pos-${value}`); } await installMainStyle(); runtime.status = `배지 위치 · ${BADGE_POSITIONS.find(([key]) => key === value)?.[1] || value}`; drawInventory(loaded); });
    root.querySelector('[data-action="manage-select"]')?.addEventListener('change', (event) => { ui.manageId = event.target.value; drawInventory(loaded); });
    root.querySelector('[data-action="manage-remove"]')?.addEventListener('click', async () => {
      try {
        const target = itemsOf(loaded.snapshot).find((item) => item.id === ui.manageId); if (!target) throw new Error('대상 아이템이 없습니다.');
        if (typeof Risuai.alertConfirm === 'function' && !(await Risuai.alertConfirm(`${target.name}을(를) 현재 채팅 인벤토리에서 제거할까요?`))) return;
        runtime.status = '수동 제거 처리 중'; drawInventory(loaded);
        const event = { kind: 'patch', patch: { id: target.id, action: null, op: 'remove', fields: {}, quantity: null, destination: '', reason: 'manual_remove', slot: null, inputs: null, outputs: null, equip: null, unequip: null } };
        const next = await commitManualEvents(loaded, [event], '수동 제거'); if (next) { next.enabled = await isEnabled(next.character); drawInventory(next); }
      } catch (error) { runtime.status = '수동 제거 실패'; if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX: ${error.message || error}`); drawInventory(loaded); }
    });
    root.querySelector('[data-action="manage-reroll"]')?.addEventListener('click', async () => {
      try {
        const target = itemsOf(loaded.snapshot).find((item) => item.id === ui.manageId); if (!target) throw new Error('대상 아이템이 없습니다.');
        const note = root.querySelector('[data-action="manage-note"]')?.value?.trim() || '';
        runtime.status = note ? '정보 수정 감정 중' : '아이템 재감정 중'; drawInventory(loaded);
        const event = await runItemModel('reroll', loaded, target, note);
        const next = await commitManualEvents(loaded, [event], note ? '정보 수정' : '재감정'); if (next) { next.enabled = await isEnabled(next.character); drawInventory(next); }
      } catch (error) { runtime.status = '재감정 실패'; if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX: ${error.message || error}`); drawInventory(loaded); }
    });
    root.querySelector('[data-action="manage-create"]')?.addEventListener('click', async () => {
      try {
        const note = root.querySelector('[data-action="create-note"]')?.value?.trim() || ''; if (!note) throw new Error('생성할 아이템 설명을 입력하세요.');
        runtime.status = '신규 아이템 생성 중'; drawInventory(loaded);
        const event = await runItemModel('create', loaded, null, note);
        const next = await commitManualEvents(loaded, [event], '신규 생성'); ui.manageId = event.item.id; if (next) { next.enabled = await isEnabled(next.character); drawInventory(next); }
      } catch (error) { runtime.status = '아이템 생성 실패'; if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX: ${error.message || error}`); drawInventory(loaded); }
    });
    root.querySelectorAll('[data-tab]').forEach((el) => el.addEventListener('click', () => {
      if (ui.tab === el.dataset.tab) return;
      ui.tab = el.dataset.tab; ui.selected = null; ui.selectedSkill = null; ui.selectedMonster = null;
      const current = root.querySelector('.itemx-main-tabs')?.nextElementSibling;
      if (current) current.innerHTML = '<div class="itemx2-tab-loading" role="status" aria-live="polite"><i></i><strong>탭 불러오는 중</strong><small>선택한 화면만 준비하고 있답니다.</small></div>';
      setTimeout(() => drawInventory(loaded), 24);
    }));
    root.querySelectorAll('[data-filter]').forEach((el) => el.addEventListener('click', () => { ui.filter = el.dataset.filter; drawInventory(loaded); }));
    root.querySelectorAll('[data-item-id]').forEach((el) => el.addEventListener('click', () => { ui.selected = el.dataset.itemId; drawInventory(loaded); }));
    root.querySelectorAll('[data-skill-id]').forEach((el) => el.addEventListener('click', () => { ui.selectedSkill = el.dataset.skillId; drawInventory(loaded); }));
    root.querySelectorAll('[data-monster-id]').forEach((el) => el.addEventListener('click', () => { ui.selectedMonster = el.dataset.monsterId; drawInventory(loaded); }));
    root.querySelector('.itemx-search-input')?.addEventListener('input', (event) => { ui.query = event.target.value; drawInventory(loaded); const input = root.querySelector('.itemx-search-input'); input?.focus(); input?.setSelectionRange(ui.query.length, ui.query.length); });
  }

  function reducedMotion() {
    return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  async function closeInventory({ immediate = false } = {}) {
    runtime.panelOpen = false;
    const transition = ++runtime.panelTransition;
    const panel = typeof document === 'undefined' ? null : document.querySelector('.itemx-panel');
    if (panel && !immediate && !reducedMotion()) {
      panel.classList.remove('itemx-plugin-panel-in');
      panel.classList.add('itemx-plugin-panel-out');
      await Promise.race([
        new Promise((resolve) => panel.addEventListener('animationend', resolve, { once: true })),
        delay(210)
      ]);
    }
    if (transition !== runtime.panelTransition || runtime.panelOpen) return;
    await Risuai.hideContainer();
    runtime.allowDrawerOverSettings = false;
    await syncHostSettingsVisibility();
  }

  async function openInventory(tab = 'inventory') {
    if (tab === 'inventory') return openRootInventory();
    const transition = ++runtime.panelTransition;
    runtime.panelOpen = true;
    ui.tab = tab;
    try {
      const compact = window.innerWidth <= 520;
      const panelWidth = compact ? Math.max(320, window.innerWidth - 32) : 420;
      const panelHeight = Math.max(420, Math.min(700, Math.round(window.innerHeight * (compact ? 0.72 : 0.78))));
      runtime.compactContainer = true;
      try {
        await Risuai.resizeContainer(panelHeight, panelWidth);
      } catch (error) {
        runtime.compactContainer = false;
        runtime.status = 'PocketRisu 호환 모드';
        log('resizeContainer unavailable; using bounded fullscreen fallback');
      }
      document.head.innerHTML = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${ITEMX_STYLE}\n${codexPageStyle()}\nhtml,body{height:100%;min-height:0!important;overflow:hidden;background:transparent!important}.risu-shell{height:100%;min-height:0;background:transparent}.itemx-plugin-stage{width:100%;height:100%;min-height:0;display:block;padding:8px}.itemx-plugin-stage .itemx-panel{width:100%;height:100%;margin:0;max-height:none}.itemx-plugin-stage-fallback{display:flex;align-items:flex-end;justify-content:flex-end;padding:12px;background:transparent}.itemx-plugin-stage-fallback .itemx-panel{width:min(420px,100%);height:min(700px,72dvh);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.58)}.itemx-plugin-panel-in{animation:itemx-plugin-panel-in 190ms cubic-bezier(.2,.78,.2,1) both}.itemx-plugin-panel-out{pointer-events:none;animation:itemx-plugin-panel-out 160ms cubic-bezier(.4,0,1,1) both}@keyframes itemx-plugin-panel-in{from{opacity:0;transform:translate3d(0,7px,0) scale(.982)}to{opacity:1;transform:none}}@keyframes itemx-plugin-panel-out{from{opacity:1;transform:none}to{opacity:0;transform:translate3d(0,5px,0) scale(.988)}}.itemx-search-input{font:inherit;outline:none}.itemx-empty{padding:2rem;text-align:center;color:#77839c}.itemx-disabled{display:grid;gap:12px;padding:28px;color:#93a2ba;overflow:auto}.itemx-disabled strong{color:#f4f0e6}.itemx-disabled .itemx-tool{justify-self:start}.itemx-main-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid #171d2b}.itemx-main-tab{min-width:0;min-height:44px;border:0;border-bottom:2px solid transparent;background:#0d121c;color:#77839c;font:inherit;font-size:.72rem;white-space:nowrap;cursor:pointer}.itemx-main-tab-on{border-bottom-color:#d4af6e;color:#f2ead9;font-weight:800}.itemx-panel>.itemx-body{flex:1;min-height:0;overflow:auto}.itemx-settings{display:grid;gap:10px;padding:16px;overflow:auto}.itemx-setting-card{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px;border:1px solid #1c2331;border-radius:12px;background:#0d121c}.itemx-setting-card span{display:grid;gap:4px}.itemx-setting-card strong{color:#edf2fb}.itemx-setting-card small,.itemx-setting-note{color:#77839c;line-height:1.45}.itemx-setting-on{border-color:#6baf88;color:#a9e6c2}.itemx-position-select{min-height:38px;padding:0 10px;border:1px solid #2b3547;border-radius:9px;background:#151d2a;color:#cbd7e9}.itemx-setting-note{margin:2px 4px 0;font-size:.72rem}.itemx-manager{display:grid;gap:10px;padding:14px;border:1px solid #303a4e;border-radius:13px;background:#0b1019}.itemx-manager-title{color:#f0d79d;font-weight:800}.itemx-manager-field{display:grid;gap:5px;color:#8592a8;font-size:.76rem}.itemx-manager-field select,.itemx-manager-field textarea{width:100%;padding:9px;border:1px solid #293448;border-radius:9px;background:#121925;color:#e3e9f3;font:inherit}.itemx-manager-field textarea{min-height:72px;resize:vertical}.itemx-manager-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.itemx-manager-danger{border-color:#65333a!important;color:#ffadb5!important}.itemx-manager-current,.itemx-manager-help{color:#718097;font-size:.72rem;line-height:1.45}.itemx-codex-fold{border:1px solid #263247;border-radius:12px;background:#0d121c;overflow:hidden}.itemx-codex-fold summary{display:grid;gap:4px;padding:14px;cursor:pointer;list-style:none}.itemx-codex-fold summary::-webkit-details-marker{display:none}.itemx-codex-fold summary strong{color:#edf2fb}.itemx-codex-fold summary small{color:#8494ad}.itemx-codex-detail{display:grid;gap:7px;padding:11px 14px 14px;border-top:1px solid #202b3c;color:#bdc8d9;font-size:.72rem;line-height:1.5}.itemx-codex-detail b{color:#7788a2}.itemx-domain-controls{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.itemx-debug-log{max-height:180px;overflow:auto;padding:9px;border:1px solid #202b3d;border-radius:8px;background:#080d15;color:#91a2ba;font:10px/1.45 monospace;white-space:pre-wrap}@media(prefers-reduced-motion:reduce){.itemx-plugin-panel-in,.itemx-plugin-panel-out{animation:none!important}}@media(max-width:380px){.itemx-plugin-stage{padding:6px}.itemx-setting-card{align-items:flex-start;flex-direction:column}.itemx-grid{grid-template-columns:1fr}.itemx-manager-actions,.itemx-domain-controls{grid-template-columns:1fr}}</style>`;
      document.body.innerHTML = '<div id="itemx2-root"></div>';
      const loaded = await rebuildCurrent();
      if (!loaded) throw new Error('No active chat context');
      loaded.enabled = await isEnabled(loaded.character);
      Object.assign(loaded, await outputSettings(loaded.character));
      runtime.debugEnabled = loaded.debugEnabled;
      drawInventory(loaded);
      await Risuai.showContainer(runtime.compactContainer ? 'floating' : 'fullscreen');
      const panel = document.querySelector('.itemx-panel');
      if (panel && transition === runtime.panelTransition && runtime.panelOpen && !reducedMotion()) panel.classList.add('itemx-plugin-panel-in');
    } catch (error) {
      if (transition === runtime.panelTransition) runtime.panelOpen = false;
      runtime.status = '인벤토리 열기 오류';
      try { await Risuai.hideContainer(); } catch {}
      fail('openInventory', error);
    }
  }

  async function toggleCurrentBot() {
    const ctx = await context(); if (!ctx) return;
    const next = !(await isEnabled(ctx.character)); await setEnabled(ctx.character, next);
    runtime.status = next ? '현재 봇 활성화' : '현재 봇 비활성화';
    await openRootInventory({ open: true, tab: 'settings' });
  }

  async function openSettingsFromRisuMenu() {
    const active = await context();
    if (!active) {
      runtime.allowDrawerOverSettings = false;
      runtime.status = '채팅 진입 대기';
      const message = 'ITEMX 설정과 인벤토리는 채팅봇에 진입한 뒤 사용할 수 있습니다.';
      if (typeof Risuai.alertNormal === 'function') await Risuai.alertNormal(message);
      else if (typeof Risuai.alertError === 'function') await Risuai.alertError(message);
      return;
    }
    runtime.activeContextKey = active.key;
    runtime.allowDrawerOverSettings = true;
    let styled = Boolean(runtime.mainDoc) || await installMainStyle();
    const loadingStarted = styled ? Date.now() : 0;
    if (styled) await mountRootLoading('ITEMX 설정 불러오는 중…');
    await updateRootLoading('연결과 권한 확인 중…');
    const connected = await installPipelineHooks({ prompt: true });
    if (!styled) {
      await delay(300);
      styled = await installMainStyle();
      if (styled) await mountRootLoading('ITEMX 설정 불러오는 중…');
    }
    await updateRootLoading('인벤토리 상태 확인 중…');
    runtime.status = connected && styled ? '연결 및 권한 정상' : connected ? '화면 연결 실패' : '모델 훅 연결 실패';
    if (loadingStarted) await delay(Math.max(0, 260 - (Date.now() - loadingStarted)));
    if (styled) await openRootInventory({ open: true, tab: 'settings' });
    else await openInventory('settings');
  }

  async function installPipelineHooks({ prompt = false } = {}) {
    if (runtime.hookInstallPromise) return runtime.hookInstallPromise;
    const pending = installPipelineHooksNow({ prompt }).finally(() => {
      if (runtime.hookInstallPromise === pending) runtime.hookInstallPromise = null;
    });
    runtime.hookInstallPromise = pending;
    return pending;
  }

  async function installDisplayHooks() {
    if (!runtime.hooks.output) { await Risuai.addRisuScriptHandler('output', outputFallback); runtime.hooks.output = true; }
    if (!runtime.hooks.display) { await Risuai.addRisuScriptHandler('display', displayHandler); runtime.hooks.display = true; }
  }

  async function installPipelineHooksNow({ prompt = false } = {}) {
    try {
      await installDisplayHooks();
      const permission = typeof Risuai.requestPluginPermission === 'function'
        ? await Risuai.requestPluginPermission('replacer')
        : true;
      runtime.permissions.replacer = permission === true;
      if (!runtime.permissions.replacer) {
        if (runtime.hooks.before) { try { await Risuai.removeRisuReplacer('beforeRequest', beforeRequest); } catch {} }
        if (runtime.hooks.after) { try { await Risuai.removeRisuReplacer('afterRequest', afterRequest); } catch {} }
        runtime.hooks.before = false;
        runtime.hooks.after = false;
        runtime.lastHookError = '모델 처리 권한이 허용되지 않았습니다';
        runtime.status = '모델 처리 권한 필요';
      } else {
        if (!runtime.hooks.before) { await Risuai.addRisuReplacer('beforeRequest', beforeRequest); runtime.hooks.before = true; }
        if (!runtime.hooks.after) { await Risuai.addRisuReplacer('afterRequest', afterRequest); runtime.hooks.after = true; }
      }
      if (!runtime.hooks.listener) {
        if (typeof Risuai.addRisuChatListener !== 'function') {
          runtime.hooks.listener = 'unsupported';
          log('chat listener unavailable; continuing with core request/output hooks');
        } else try {
          await Risuai.addRisuChatListener('output', async (event) => {
            try {
              await rebuildCurrent();
              await catchUpLatestOutput();
              await ensureRootInventory();
            } catch (error) { fail('chat listener', error); }
          });
          runtime.hooks.listener = true;
        } catch (error) {
          const message = String(error?.message || error || '');
          if (!/API method addRisuChatListener not found/i.test(message)) throw error;
          runtime.hooks.listener = 'unsupported';
          log('chat listener unavailable; continuing with core request/output hooks');
        }
      }
      if (runtime.permissions.replacer) {
        runtime.lastHookError = '';
        runtime.status = prompt ? '모델 처리 권한 연결됨' : '정상';
      }
      return runtime.permissions.replacer;
    } catch (error) {
      runtime.permissions.replacer = false;
      runtime.lastHookError = String(error?.message || error || '알 수 없는 모델 훅 오류');
      runtime.status = '모델 연결 오류';
      fail('pipeline hooks', error);
      return false;
    }
  }

  try {
    await loadBadgePosition();
    const setting = await Risuai.registerSetting('ITEMX 2 · 권한 및 설정', openSettingsFromRisuMenu, '💎', 'html', 'itemx2-current-bot');
    if (setting?.id) runtime.uiParts.push(setting.id);
    await installDisplayHooks();
    const initial = await context();
    let connected = false, styled = false;
    if (initial) {
      runtime.activeContextKey = initial.key;
      runtime.status = '초기 화면 연결 중';
      styled = await installMainStyle();
      const loadingStarted = styled ? Date.now() : 0;
      if (styled) await mountRootLoading('ITEMX 초기화 중…');
      await updateRootLoading('모델 처리 연결 중…');
      connected = await installPipelineHooks();
      await updateRootLoading('채팅 인벤토리 복원 중…');
      await rebuildCurrent({ upgradeDisplayRefs: true });
      if (loadingStarted) await delay(Math.max(0, 320 - (Date.now() - loadingStarted)));
      if (styled) await openRootInventory({ open: false });
      void checkForUpdate();
    } else {
      runtime.status = '채팅 진입 대기';
    }
    runtime.remountTimer = globalThis.setInterval(() => {
      if (runtime.bodyFxScrollActive) return;
      if (!runtime.activeContextKey || !runtime.hostObserver || Date.now() - runtime.remountFallbackAt >= 10000) void ensureRootInventory();
    }, 1200);
    runtime.catchUpTimer = globalThis.setInterval(() => { void catchUpLatestOutput().catch((error) => fail('latest output catch-up', error)); }, 4500);
    runtime.updateTimer = globalThis.setInterval(() => { void checkForUpdate(); }, ITEMX_UPDATE_CHECK_MS);
    if (initial) void catchUpLatestOutput().catch((error) => fail('initial output catch-up', error));
    if (connected && styled) runtime.status = '정상';
    log(`v${ITEMX_PLUGIN_VERSION} ready`);
  } catch (error) {
    runtime.status = '초기화 오류';
    await removeRootDrawer();
    if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX 초기화 실패: ${error.message || error}`);
    fail('bootstrap', error);
  }

  await Risuai.onUnload(async () => {
    runtime.panelOpen = false;
    runtime.panelTransition += 1;
    if (runtime.remountTimer) globalThis.clearInterval(runtime.remountTimer);
    runtime.remountTimer = null;
    if (runtime.catchUpTimer) globalThis.clearInterval(runtime.catchUpTimer);
    runtime.catchUpTimer = null;
    if (runtime.updateTimer) globalThis.clearInterval(runtime.updateTimer);
    runtime.updateTimer = null;
    if (runtime.hostSyncTimer) globalThis.clearTimeout(runtime.hostSyncTimer);
    runtime.hostSyncTimer = null;
    if (runtime.feedbackTimer) globalThis.clearTimeout(runtime.feedbackTimer);
    runtime.feedbackTimer = null;
    if (runtime.auxToastTimer) globalThis.clearTimeout(runtime.auxToastTimer);
    runtime.auxToastTimer = null;
    if (runtime.legacyCommitTimer) globalThis.clearTimeout(runtime.legacyCommitTimer);
    runtime.legacyCommitTimer = null;
    if (runtime.bodyFxStartTimer) globalThis.clearTimeout(runtime.bodyFxStartTimer);
    runtime.bodyFxStartTimer = null;
    if (runtime.bodyFxScrollTimer) globalThis.clearTimeout(runtime.bodyFxScrollTimer);
    runtime.bodyFxScrollTimer = null;
    if (runtime.bodyFxScrollActive && runtime.bodyFxClassOwner) {
      try { await runtime.bodyFxClassOwner.removeClass('x-risu-itemx-body-scrolling'); } catch {}
    }
    runtime.bodyFxScrollActive = false;
    try { await Risuai.hideContainer(); } catch {}
    await removeRootDrawer();
    try { if (runtime.badgeEventOwner && runtime.badgeEventId) await runtime.badgeEventOwner.removeEventListener('click', runtime.badgeEventId); } catch {}
    for (const binding of runtime.bodyFxEventIds) { try { if (runtime.bodyFxEventOwner) await runtime.bodyFxEventOwner.removeEventListener(binding.type, binding.id, true); } catch {} }
    runtime.bodyFxEventIds = [];
    try { if (runtime.hostObserver?.disconnect) await runtime.hostObserver.disconnect(); } catch {}
    runtime.hostObserver = null;
    try { await Risuai.removeRisuScriptHandler('output', outputFallback); } catch {}
    try { await Risuai.removeRisuScriptHandler('display', displayHandler); } catch {}
    try { await Risuai.removeRisuReplacer('beforeRequest', beforeRequest); } catch {}
    try { await Risuai.removeRisuReplacer('afterRequest', afterRequest); } catch {}
    for (const id of runtime.uiParts) { try { await Risuai.unregisterUIPart(id); } catch {} }
    try { if (runtime.mainStyle) await runtime.mainStyle.remove(); } catch {}
  });
})();
