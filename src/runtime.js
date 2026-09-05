/* Build placeholders are replaced by scripts/build.mjs. */
const ITEMX_STYLE = __ITEMX_STYLE_JSON__;
const ITEMX_CHAT_STYLE = __ITEMX_CHAT_STYLE_JSON__;
const ITEMX_MAIN_STYLE = __ITEMX_MAIN_STYLE_JSON__;
const ITEMX_CHIP_STYLE =
  '.itemx-event-chip{display:inline-flex;align-items:center;max-width:100%;margin:.28em .2em;padding:.28em .58em;border:1px solid rgba(126,145,174,.26);border-radius:999px;background:rgba(18,25,38,.72);color:#dce6f4;font-size:.76rem;font-weight:700;line-height:1.35;vertical-align:middle}';
const ITEMX_CODEX_INLINE_STYLE = `.itemx2-inline-event{--ix-tone:#a58add;position:relative;isolation:isolate;display:block;max-width:720px;margin:.7rem auto 1rem;overflow:hidden;border:1px solid rgba(132,146,170,.34);border-radius:14px;background:linear-gradient(145deg,rgba(24,31,44,.98),rgba(11,15,23,.98));box-shadow:0 12px 30px rgba(0,0,0,.25),inset 0 1px rgba(255,255,255,.035);content-visibility:auto;contain:layout paint style;contain-intrinsic-size:auto 128px;color:#e9eef6;font-family:Inter,Pretendard,"Noto Sans KR",sans-serif}.itemx2-inline-event::before{content:"";position:absolute;z-index:-2;inset:-65% -12% auto 40%;height:180%;background:radial-gradient(closest-side,var(--ix-glow,rgba(165,138,221,.22)),transparent 72%);transform:rotate(-12deg)}.itemx2-inline-event::after{content:"";position:absolute;z-index:-1;inset:0;background:linear-gradient(105deg,transparent 48%,rgba(255,255,255,.025),transparent 84%)}.itemx2-inline-main{display:grid;grid-template-columns:50px minmax(0,1fr) auto;align-items:center;gap:11px;min-height:86px;padding:12px}.itemx2-inline-icon{position:relative;width:50px;height:50px;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(150,165,190,.3);border-radius:12px;background:radial-gradient(circle at 35% 27%,var(--ix-glow,rgba(165,138,221,.22)),rgba(9,12,18,.86) 72%);font-size:1.45rem;box-shadow:inset 0 0 18px rgba(120,135,165,.08)}.itemx2-inline-copy{display:grid;gap:3px;min-width:0}.itemx2-inline-kicker{color:var(--ix-tone);font-size:.53rem;font-weight:900;letter-spacing:.15em}.itemx2-inline-name{overflow:hidden;color:#f1f4f9;font-size:.94rem;font-weight:900;line-height:1.3;text-overflow:ellipsis;white-space:nowrap}.itemx2-inline-meta{color:#8795aa;font-size:.61rem}.itemx2-inline-state{align-self:start;padding:4px 7px;border:1px solid rgba(150,165,190,.28);border-radius:999px;background:rgba(120,135,160,.08);color:var(--ix-tone);font-size:.53rem;font-weight:900;font-style:normal}.itemx2-inline-delta{display:flex;align-items:center;gap:5px;margin-top:3px;font-size:.58rem}.itemx2-inline-delta i{padding:3px 6px;border-radius:6px;background:rgba(255,255,255,.045);color:#8794a8;font-style:normal}.itemx2-inline-delta i:last-child{color:#f2cd80}.itemx2-inline-delta b{color:#69778d}.itemx2-inline-foot{display:flex;align-items:flex-start;gap:7px;padding:9px 12px;border-top:1px solid rgba(255,255,255,.055);background:rgba(4,7,12,.24);color:#95a1b3;font-size:.64rem;line-height:1.45}.itemx2-inline-foot b{flex:0 0 auto;color:var(--ix-tone);font-size:.57rem}.itemx2-inline-skill-theme-fire{--ix-tone:#f0ad66;--ix-glow:rgba(226,92,43,.26)}.itemx2-inline-skill-theme-ice{--ix-tone:#91dff1;--ix-glow:rgba(82,184,218,.22)}.itemx2-inline-skill-theme-lightning{--ix-tone:#f0d878;--ix-glow:rgba(131,151,255,.24)}.itemx2-inline-skill-theme-dark{--ix-tone:#b697e8;--ix-glow:rgba(91,44,141,.3)}.itemx2-inline-skill-theme-light{--ix-tone:#ead9a8;--ix-glow:rgba(235,216,161,.2)}.itemx2-inline-skill-theme-arcane{--ix-tone:#b59bea;--ix-glow:rgba(128,91,207,.24)}.itemx2-inline-skill .itemx2-inline-icon::before{content:"";position:absolute;width:31px;height:31px;border-radius:44% 56% 62% 38%;background:radial-gradient(circle at 65% 30%,rgba(255,255,255,.48),var(--ix-glow) 32%,transparent 68%);animation:itemx2-inline-drift 7s ease-in-out infinite alternate}.itemx2-inline-icon>span{position:relative;z-index:1}.itemx2-inline-encounter{--ix-tone:#df8588;--ix-glow:rgba(199,69,76,.22)}.itemx2-inline-encounter .itemx2-inline-icon{background:radial-gradient(circle at 50% 24%,rgba(133,82,100,.82),rgba(58,39,55,.9) 48%,#11141b 78%);text-shadow:0 5px 12px #000}.itemx2-inline-warning{position:absolute;z-index:-1;right:-8%;bottom:16px;width:62%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,102,102,.7),transparent);box-shadow:0 0 7px rgba(255,80,80,.5);animation:itemx2-inline-scan 4.4s ease-in-out infinite}.itemx2-inline-ended{--ix-tone:#a6aeb9;--ix-glow:rgba(150,160,173,.13)}.itemx2-inline-ended .itemx2-inline-icon{filter:grayscale(1) saturate(.2) brightness(.72)}.itemx2-inline-ended .itemx2-inline-warning{display:none}.itemx2-inline-ended::before{animation:none}.itemx2-inline-event.motion-off::before,.itemx2-inline-event.motion-off::after,.itemx2-inline-event.motion-off .itemx2-inline-icon::before,.itemx2-inline-event.motion-off .itemx2-inline-warning{display:none!important;animation:none!important}@keyframes itemx2-inline-drift{from{transform:translate(-3px,2px) rotate(-8deg);opacity:.62}to{transform:translate(4px,-3px) rotate(11deg);opacity:1}}@keyframes itemx2-inline-scan{0%,100%{transform:translateY(-13px);opacity:.12}45%,55%{opacity:.72}50%{transform:translateY(13px)}}@media(prefers-reduced-motion:reduce){.itemx2-inline-event::before,.itemx2-inline-event::after,.itemx2-inline-icon::before,.itemx2-inline-warning{animation:none!important}}@media(max-width:520px){.itemx2-inline-event{margin:.62rem 0 .9rem}.itemx2-inline-main{grid-template-columns:46px minmax(0,1fr) auto;gap:9px;padding:10px}.itemx2-inline-icon{width:46px;height:46px}.itemx2-inline-name{font-size:.86rem}.itemx2-inline-foot{font-size:.6rem}}`;
const ITEMX_CODEX_INLINE_DENSE_STYLE = `.itemx2-inline-event.itemx2-inline-event{align-self:start;box-sizing:border-box;width:min(400px,calc(100% - 8px));max-width:400px;margin:.42rem auto .65rem;border-radius:11px;line-height:1.2}.itemx2-inline-event .itemx2-inline-main{grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:8px;min-height:54px;height:auto;padding:6px 8px 5px}.itemx2-inline-event .itemx2-inline-icon{align-self:center;width:36px;height:36px;min-width:36px;min-height:36px;border-radius:9px;font-size:1.08rem;line-height:1}.itemx2-inline-event .itemx2-inline-copy{align-self:center;gap:1px;line-height:1.15}.itemx2-inline-event .itemx2-inline-kicker{font-size:.46rem;line-height:1.2;letter-spacing:.12em}.itemx2-inline-event .itemx2-inline-name{font-size:.82rem;line-height:1.18}.itemx2-inline-event .itemx2-inline-meta{font-size:.51rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.itemx2-inline-event .itemx2-inline-quick{display:flex;align-items:center;gap:3px;min-width:0;margin-top:2px;overflow:hidden}.itemx2-inline-event .itemx2-inline-quick i{flex:0 1 auto;min-width:0;height:auto;padding:1px 4px;border:1px solid rgba(150,165,190,.16);border-radius:4px;background:rgba(255,255,255,.035);color:#9ca9bb;font-size:.47rem;font-style:normal;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.itemx2-inline-event .itemx2-inline-quick i b{color:var(--ix-tone);font-weight:900}.itemx2-inline-event .itemx2-inline-foot{align-items:center;min-height:23px;height:auto;padding:4px 8px;font-size:.53rem;line-height:1.3}.itemx2-inline-event .itemx2-inline-foot b{font-size:.49rem}.itemx2-inline-event .itemx2-inline-foot span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.itemx2-inline-event .itemx2-inline-state{display:inline-flex;align-self:center;align-items:center;justify-content:center;width:auto;height:auto;min-height:0;padding:2px 5px;font-size:.46rem;line-height:1.2;white-space:nowrap}@media(max-width:520px){.itemx2-inline-event.itemx2-inline-event{margin:.36rem auto .58rem}.itemx2-inline-event .itemx2-inline-main{grid-template-columns:34px minmax(0,1fr) auto;gap:6px;min-height:51px;padding:5px 7px 4px}.itemx2-inline-event .itemx2-inline-icon{width:34px;height:34px;min-width:34px;min-height:34px}.itemx2-inline-event .itemx2-inline-name{font-size:.78rem}.itemx2-inline-event .itemx2-inline-quick{gap:2px}.itemx2-inline-event .itemx2-inline-quick i{padding:1px 3px;font-size:.44rem}.itemx2-inline-event .itemx2-inline-quick i:nth-last-child(n+5){display:none}.itemx2-inline-event .itemx2-inline-foot{min-height:21px;padding:3px 7px;font-size:.5rem}}`;
const ITEMX_CODEX_INLINE_APPRAISAL_STYLE = `
.itemx2-inline-event.itemx2-inline-appraisal{--ix-fg:#e8e0d2;--ix-dim:#9f9586;--ix-line:#544936;--ix-surface:rgba(93,76,48,.18);border:1px solid var(--ix-line);border-radius:3px;background:repeating-linear-gradient(102deg,rgba(255,235,190,.024) 0 2px,transparent 2px 7px),repeating-linear-gradient(11deg,rgba(0,0,0,.13) 0 3px,transparent 3px 9px),radial-gradient(115% 92% at 50% -16%,#292218,#11100e 72%);color:var(--ix-fg);font-family:"Nanum Myeongjo","Noto Serif KR",Georgia,serif;box-shadow:inset 0 0 36px rgba(0,0,0,.54),0 7px 18px rgba(0,0,0,.22),0 0 14px color-mix(in srgb,var(--rk,#a58add) 18%,transparent)}
.itemx2-inline-event.itemx2-inline-appraisal::before{inset:0 0 auto;z-index:5;width:auto;height:2px;background:linear-gradient(90deg,transparent,var(--rk,#a58add) 18%,var(--rk,#a58add) 82%,transparent);opacity:.82;transform:none}
.itemx2-inline-event.itemx2-inline-appraisal::after{z-index:-1;background:radial-gradient(72% 125% at 8% 20%,var(--ix-glow),transparent 68%),linear-gradient(105deg,transparent 54%,rgba(255,255,255,.025),transparent 86%)}
.itemx2-inline-appraisal .itemx2-inline-main{position:relative;grid-template-columns:42px minmax(0,1fr) auto;gap:8px;min-height:58px;padding:8px 9px 6px}
.itemx2-inline-appraisal .itemx2-inline-main::before{content:"";position:absolute;right:-12%;bottom:-58%;width:66%;height:145%;border-radius:50%;background:radial-gradient(closest-side,var(--ix-glow),transparent 73%);opacity:.7;pointer-events:none}
.itemx2-inline-appraisal .itemx2-inline-icon{width:42px;height:42px;min-width:42px;min-height:42px;border:1px solid color-mix(in srgb,var(--rk,#a58add) 58%,#4c4437);border-radius:50%;background:radial-gradient(circle at 35% 28%,color-mix(in srgb,var(--rk,#a58add) 26%,transparent),rgba(12,11,10,.94) 70%);font-size:1.2rem;box-shadow:inset 0 0 0 2px rgba(9,8,7,.55),inset 0 0 15px var(--ix-glow),0 0 10px color-mix(in srgb,var(--rk,#a58add) 18%,transparent)}
.itemx2-inline-appraisal .itemx2-inline-copy{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1px 6px}
.itemx2-inline-appraisal .itemx2-inline-kicker{grid-column:1/-1;color:color-mix(in srgb,var(--rk,#a58add) 76%,#dccba8);font-size:.43rem;letter-spacing:.18em}
.itemx2-inline-appraisal .itemx2-inline-name{grid-column:1;align-self:end;color:#f2eadc;font-size:.84rem;text-shadow:0 1px 2px #000,0 0 7px var(--ix-glow)}
.itemx2-inline-appraisal .itemx2-inline-tier{grid-column:2;align-self:end;color:var(--rk,#c7ae79);font-size:.52rem;font-weight:800;white-space:nowrap}
.itemx2-inline-appraisal .itemx2-inline-meta{grid-column:1/-1;color:var(--ix-dim);font-size:.49rem}
.itemx2-inline-appraisal .itemx2-inline-state{position:relative;z-index:1;align-self:start;margin-top:1px;border:1px solid color-mix(in srgb,var(--rk,#a58add) 44%,#4e4639);border-radius:2px;background:rgba(18,15,11,.6);color:color-mix(in srgb,var(--rk,#a58add) 78%,#efe2c8);font-size:.44rem;letter-spacing:.04em}
.itemx2-inline-appraisal .itemx2-inline-rule{height:1px;margin:0 9px;background:linear-gradient(90deg,transparent,var(--ix-line) 12%,color-mix(in srgb,var(--rk,#a58add) 34%,var(--ix-line)) 50%,var(--ix-line) 88%,transparent)}
.itemx2-inline-appraisal .itemx2-inline-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;margin:5px 8px 6px;overflow:visible}
.itemx2-inline-appraisal .itemx2-inline-quick i{display:grid;gap:1px;min-width:0;padding:3px 4px;border:1px solid color-mix(in srgb,var(--ix-line) 72%,transparent);border-radius:2px;background:var(--ix-surface);color:#d8d0c3;font-size:.48rem;line-height:1.15;white-space:normal}
.itemx2-inline-appraisal .itemx2-inline-quick i b{overflow:hidden;color:var(--ix-dim);font-size:.39rem;letter-spacing:.08em;text-overflow:ellipsis;white-space:nowrap}
.itemx2-inline-appraisal .itemx2-inline-quick i span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.itemx2-inline-appraisal .itemx2-inline-foot{min-height:25px;padding:4px 8px;border-top:1px solid rgba(180,158,116,.13);background:rgba(5,5,4,.26);color:#bcb2a2;font-size:.51rem}
.itemx2-inline-appraisal .itemx2-inline-foot b{color:color-mix(in srgb,var(--rk,#a58add) 72%,#ddc99e);font-size:.43rem;letter-spacing:.08em}
.itemx2-inline-appraisal.itemx2-inline-encounter{--ix-line:#51413f;--ix-surface:rgba(95,53,52,.16);background:repeating-linear-gradient(101deg,rgba(237,199,190,.018) 0 2px,transparent 2px 8px),radial-gradient(105% 85% at 84% 0,rgba(121,48,53,.16),transparent 64%),linear-gradient(151deg,#1c1715,#0e0e0e 68%)}
.itemx2-inline-appraisal.itemx2-inline-ended{--ix-line:#41454b;--ix-surface:rgba(92,98,108,.12);filter:none;background:repeating-linear-gradient(101deg,rgba(220,225,232,.014) 0 2px,transparent 2px 8px),linear-gradient(151deg,#18191a,#0d0e10 70%)}
.itemx2-inline-appraisal.itemx2-inline-ended::after{filter:grayscale(1);opacity:.46}
.itemx2-inline-appraisal.motion-off::before{display:block!important;animation:none!important}
@media(max-width:520px){.itemx2-inline-appraisal .itemx2-inline-main{grid-template-columns:38px minmax(0,1fr) auto;min-height:54px;padding:7px 7px 5px}.itemx2-inline-appraisal .itemx2-inline-icon{width:38px;height:38px;min-width:38px;min-height:38px}.itemx2-inline-appraisal .itemx2-inline-quick{grid-template-columns:repeat(2,minmax(0,1fr));margin:4px 7px 5px}.itemx2-inline-appraisal .itemx2-inline-quick i{padding:3px}.itemx2-inline-appraisal .itemx2-inline-quick i:nth-last-child(n+5){display:grid}.itemx2-inline-appraisal .itemx2-inline-foot{padding:4px 7px}}
`;
const ITEMX_PROTOCOL_TEXT = __ITEMX_PROTOCOL_JSON__;
const ITEMX_PLUGIN_VERSION = __ITEMX_PLUGIN_VERSION_JSON__;
const ITEMX_VERSION_LABEL = __ITEMX_VERSION_LABEL_JSON__;
const ITEMX_UPDATE_URL = 'https://raw.githubusercontent.com/canister2668/itemx2/main/dist/itemx2.plugin.js';
const ITEMX_UPDATE_CACHE_KEY = 'itemx2:update-check';
const ITEMX_UPDATE_CHECK_MS = 30 * 60 * 1000;
const ITEMX_MANUAL_KEY = '$__itemx2_manual_events';
const ITEMX_PRESENTATION_STYLE = __ITEMX_PRESENTATION_STYLE_JSON__;
const ITEMX_MESSAGE_EVENT_KEY = '$__itemx2_message_events';
const ITEMX_CHECKPOINT_KEY = '$__itemx2_checkpoint';
const ITEMX_AUX_KEY = '$__itemx2_aux_processed';
const ITEMX_LORE_KEY = '$__itemx2_lore_enrichment';
const ITEMX_REF_RE = /<!--ITEMX2@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?-->/g;
const ITEMX_CODEX_REF_RE = /<!--CODEX2@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?-->/g;
const ITEMX_AUX_SETTLE_MS = 1500;
const ITEMX_AUX_PROMPT_REVISION = 2;
const ITEMX_ROOT_PAGE_SIZE = 16;
const ITEMX_CHECKPOINT_TAIL_EVENTS = 128;
const ITEMX_CHECKPOINT_TAIL_MESSAGES = 32;
const ITEMX_CHECKPOINT_TRIGGER_MESSAGES = 128;
const ITEMX_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="176" viewBox="0 0 48 176" role="img" aria-label="ITEMX CODEX"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#1b2940"/><stop offset="1" stop-color="#090d17"/></linearGradient><filter id="s" x="-40%" y="-20%" width="180%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-opacity=".52"/></filter></defs><g filter="url(#s)"><rect x="1" y="1" width="46" height="174" rx="10" fill="url(#g)" stroke="#536684" stroke-width="1.2"/><path d="M2 35h44M2 141h44" stroke="#263650" stroke-width="1"/></g><text x="24" y="26" text-anchor="middle" font-size="17">📦</text><text x="24" y="88" text-anchor="middle" dominant-baseline="middle" transform="rotate(90 24 88)" fill="#f1f5fc" font-family="Arial,sans-serif" font-size="10.5" font-weight="900" letter-spacing="2">CODEX</text><path d="M17 154h14M24 147v14" fill="none" stroke="#9abcf4" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const ITEMX_BADGE_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ITEMX_BADGE_SVG)}`;

(async () => {
  'use strict';
  const queues = new Map();
  const ui = {
    tab: 'inventory',
    filter: 'all',
    query: '',
    selected: null,
    selectedSkill: null,
    selectedMonster: null,
    manageId: null,
    motion: true
  };
  const runtime = {
    latestMarkers: new Set(),
    latestOutput: '',
    pendingMarkers: new Set(),
    pendingMarkersAt: 0,
    eventPayloads: new Map(),
    presentationRecords: null,
    eventBursts: new Map(),
    eventBurstSeen: new Set(),
    eventBurstTimers: new Set(),
    eventBurstOwners: new Set(),
    eventBurstBusy: false,
    itemRepairBusy: false,
    markerHtmlCache: new Map(),
    detailHtmlCache: new Map(),
    settingsCache: new Map(),
    settingsLoadPromises: new Map(),
    cachedLoaded: null,
    cachedGeneration: -1,
    portraitCache: new Map(),
    portraitCacheBytes: 0,
    mainStyle: null,
    mainStylePosition: '',
    mainDoc: null,
    rootDrawer: null,
    rootOpen: false,
    rootFingerprint: '',
    rootContentReady: false,
    rootHydratedDetail: '',
    activeRootTab: 'inventory',
    rootItemPage: 0,
    rootTabBusy: false,
    rootClickBusy: false,
    rootClickOwner: null,
    rootClickBindings: [],
    bodyFxEventOwner: null,
    bodyFxEventIds: [],
    bodyFxClassOwner: null,
    bodyFxStartTimer: null,
    bodyFxScrollTimer: null,
    bodyFxScrollActive: false,
    bodyFxSawScroll: false,
    outputSyncDeferred: false,
    uiParts: [],
    generation: 0,
    remountTimer: null,
    remountInterval: 0,
    remountFallbackAt: 0,
    homeProbeAt: 0,
    catchUpTimer: null,
    updateTimer: null,
    hostObserver: null,
    hostSyncTimer: null,
    hostSyncDeferred: false,
    hostSyncBusy: false,
    hostSettingsCache: { at: 0, visible: false },
    feedbackTimer: null,
    catchUpFingerprint: '',
    catchUpFailedFingerprint: '',
    catchUpFailures: 0,
    catchUpRetryAt: 0,
    auxCandidateFingerprint: '',
    auxCandidateSince: 0,
    auxCandidateChecks: 0,
    legacyCommitTimer: null,
    remounting: false,
    hookInstallPromise: null,
    outputSyncPromise: null,
    outputSyncPending: false,
    connectionBusy: false,
    settingChangeBusy: false,
    auxRecoveryPromise: null,
    status: 'UI 준비',
    lastDomError: '',
    lastHookError: '',
    unloading: false,
    hooks: { process: false, output: false, display: false, before: false, after: false, listener: false },
    permissions: { replacer: null, mainDom: null, db: null },
    badgePosition: 'rm',
    compactContainer: true,
    moduleAssetCache: { key: '', at: 0, rows: [] },
    characterAssetCache: { key: '', at: 0, rows: [] },
    combinedAssetCache: { key: '', at: 0, rows: [] },
    lorebookCache: { key: '', at: 0, rows: [] },
    lorebookScanPromise: null,
    lorebookAutoFingerprint: '',
    panelOpen: false,
    panelTransition: 0,
    auxActive: 0,
    auxLabel: '보조 모델 처리 중',
    auxToastTimer: null,
    auxProviderUnavailable: false,
    auxProviderError: '',
    uiRemountAfter: 0,
    hostSettingsVisible: false,
    allowDrawerOverSettings: false,
    activeContextKey: '',
    checkpointCacheRaw: null,
    checkpointCache: null,
    auxLast: { state: 'idle', label: '아직 실행 기록 없음', at: 0, events: null },
    update: { checking: false, checkedAt: 0, latest: '', available: false },
    debugEnabled: false,
    visualEffectsEnabled: true,
    debugEntries: [],
    cleanupArmedUntil: 0
  };

  const log = (...args) => console.log('[ITEMX 2]', ...args);
  const debugRecord = (where, detail = '') => {
    if (!runtime.debugEnabled) return;
    const text = typeof detail === 'string' ? detail : JSON.stringify(detail);
    runtime.debugEntries.push({ at: Date.now(), where: String(where), detail: String(text || '').slice(0, 500) });
    if (runtime.debugEntries.length > 30) runtime.debugEntries.splice(0, runtime.debugEntries.length - 30);
    console.log(`[ITEMX 2 · DEBUG] ${where}`, detail);
  };
  const fail = (where, error) => {
    debugRecord(`ERROR · ${where}`, error?.message || String(error));
    console.error(`[ITEMX 2] ${where}`, error);
  };
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
    } catch (error) {
      fail('update indicator', error);
    }
  }
  async function checkForUpdate() {
    if (runtime.update.checking || !runtime.activeContextKey || typeof Risuai.nativeFetch !== 'function') return;
    runtime.update.checking = true;
    try {
      let cached = null;
      try {
        cached = JSON.parse((await Risuai.safeLocalStorage.getItem(ITEMX_UPDATE_CACHE_KEY)) || 'null');
      } catch {}
      if (cached?.latest) {
        runtime.update.checkedAt = Number(cached.checkedAt) || 0;
        runtime.update.latest = String(cached.latest);
        runtime.update.available = compareVersions(runtime.update.latest, ITEMX_PLUGIN_VERSION) > 0;
        await syncUpdateIndicator();
      }
      if (Date.now() - runtime.update.checkedAt < ITEMX_UPDATE_CHECK_MS) return;
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
      runtime.update.checkedAt = Date.now();
      runtime.update.latest = latest;
      runtime.update.available = compareVersions(latest, ITEMX_PLUGIN_VERSION) > 0;
      try {
        await Risuai.safeLocalStorage.setItem(
          ITEMX_UPDATE_CACHE_KEY,
          JSON.stringify({ checkedAt: runtime.update.checkedAt, latest })
        );
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

  async function context() {
    try {
      const [characterIndex, chatIndex, character] = await Promise.all([
        Risuai.getCurrentCharacterIndex(),
        Risuai.getCurrentChatIndex(),
        Risuai.getCharacter()
      ]);
      if (characterIndex == null || chatIndex == null || !character) return null;
      const chat = await Risuai.getChatFromIndex(characterIndex, chatIndex);
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

  const settingsId = (character) => character?.chaId || 'unknown';
  const cachedSettings = (character) => runtime.settingsCache.get(settingsId(character));
  function updateCachedSettings(character, patch) {
    const id = settingsId(character),
      current = runtime.settingsCache.get(id);
    if (current) runtime.settingsCache.set(id, { ...current, ...patch });
    if ('effectsEnabled' in patch) runtime.visualEffectsEnabled = Boolean(patch.effectsEnabled);
  }

  async function outputSettings(character, { refresh = false } = {}) {
    const id = character?.chaId || 'unknown';
    if (!refresh && runtime.settingsCache.has(id)) return { ...runtime.settingsCache.get(id) };
    if (!refresh && runtime.settingsLoadPromises.has(id)) return { ...(await runtime.settingsLoadPromises.get(id)) };
    const loading = Promise.all([
      Risuai.pluginStorage.getItem(`enabled:${id}`),
      Risuai.pluginStorage.getItem(`mainOutput:${id}`),
      Risuai.pluginStorage.getItem(`auxOutput:${id}`),
      Risuai.pluginStorage.getItem(`rarityMode:${id}`),
      Risuai.pluginStorage.getItem(`itemsEnabled:${id}`),
      Risuai.pluginStorage.getItem(`skillsEnabled:${id}`),
      Risuai.pluginStorage.getItem(`encountersEnabled:${id}`),
      Risuai.pluginStorage.getItem(`debugEnabled:${id}`),
      Risuai.pluginStorage.getItem(`effectsEnabled:${id}`),
      Risuai.pluginStorage.getItem(`fontScale:${id}`),
      Risuai.pluginStorage.getItem(`moduleAssetsEnabled:${id}`),
      Risuai.pluginStorage.getItem(`lorebookEncounterEnabled:${id}`)
    ])
      .then(
        ([
          enabled,
          main,
          aux,
          rarity,
          items,
          skills,
          encounters,
          debug,
          effects,
          fontScale,
          moduleAssets,
          lorebookEncounter
        ]) => {
          const settings = {
            enabled: enabled !== '0',
            mainOutput: main !== '0',
            // The public API cannot preflight the shared auxiliary provider.
            auxOutput: ['off', 'missing', 'always'].includes(aux) ? aux : 'off',
            rarityMode: ['world', 'itemx'].includes(rarity) ? rarity : 'world',
            itemsEnabled: items !== '0',
            skillsEnabled: skills !== '0',
            encountersEnabled: encounters !== '0',
            debugEnabled: debug === '1',
            effectsEnabled: effects !== '0',
            fontScale: ['small', 'medium', 'large'].includes(fontScale) ? fontScale : 'small',
            moduleAssetsEnabled: moduleAssets === '1',
            lorebookEncounterEnabled: lorebookEncounter === '1'
          };
          runtime.settingsCache.set(id, settings);
          runtime.visualEffectsEnabled = settings.effectsEnabled;
          return settings;
        }
      )
      .finally(() => runtime.settingsLoadPromises.delete(id));
    runtime.settingsLoadPromises.set(id, loading);
    return { ...(await loading) };
  }

  async function isEnabled(character) {
    return (cachedSettings(character) || (await outputSettings(character))).enabled;
  }

  async function setEnabled(character, value) {
    await Risuai.pluginStorage.setItem(`enabled:${settingsId(character)}`, value ? '1' : '0');
    updateCachedSettings(character, { enabled: Boolean(value) });
  }

  async function setDomainEnabled(character, domain, value) {
    const keys = { items: 'itemsEnabled', skills: 'skillsEnabled', encounters: 'encountersEnabled' };
    if (!keys[domain]) throw new Error('Invalid ITEMX domain');
    await Risuai.pluginStorage.setItem(`${keys[domain]}:${character?.chaId || 'unknown'}`, value ? '1' : '0');
    updateCachedSettings(character, { [keys[domain]]: Boolean(value) });
    runtime.catchUpFingerprint = '';
    runtime.catchUpFailedFingerprint = '';
    runtime.auxCandidateFingerprint = '';
  }

  async function setDebugEnabled(character, value) {
    runtime.debugEnabled = Boolean(value);
    await Risuai.pluginStorage.setItem(`debugEnabled:${character?.chaId || 'unknown'}`, value ? '1' : '0');
    updateCachedSettings(character, { debugEnabled: Boolean(value) });
    debugRecord('debug', value ? 'enabled' : 'disabled');
  }

  async function setMainOutput(character, value) {
    await Risuai.pluginStorage.setItem(`mainOutput:${character?.chaId || 'unknown'}`, value ? '1' : '0');
    updateCachedSettings(character, { mainOutput: Boolean(value) });
  }

  async function setAuxOutput(character, value) {
    if (!['off', 'missing', 'always'].includes(value)) throw new Error('Invalid auxiliary output mode');
    await Risuai.pluginStorage.setItem(`auxOutput:${character?.chaId || 'unknown'}`, value);
    updateCachedSettings(character, { auxOutput: value });
    runtime.catchUpFingerprint = '';
    runtime.catchUpFailedFingerprint = '';
    runtime.auxCandidateFingerprint = '';
  }

  async function setRarityMode(character, value) {
    if (!['world', 'itemx'].includes(value)) throw new Error('Invalid rarity mode');
    await Risuai.pluginStorage.setItem(`rarityMode:${character?.chaId || 'unknown'}`, value);
    updateCachedSettings(character, { rarityMode: value });
  }

  async function setEffectsEnabled(character, value) {
    await Risuai.pluginStorage.setItem(`effectsEnabled:${settingsId(character)}`, value ? '1' : '0');
    updateCachedSettings(character, { effectsEnabled: Boolean(value) });
    runtime.markerHtmlCache.clear();
    runtime.detailHtmlCache.clear();
    await syncMainEffectsState();
  }

  async function setFontScale(character, value) {
    if (!['small', 'medium', 'large'].includes(value)) throw new Error('Invalid font scale');
    await Risuai.pluginStorage.setItem(`fontScale:${settingsId(character)}`, value);
    updateCachedSettings(character, { fontScale: value });
    await syncRootFontScale(value);
  }

  async function setModuleAssetsEnabled(character, value) {
    await Risuai.pluginStorage.setItem(`moduleAssetsEnabled:${settingsId(character)}`, value ? '1' : '0');
    updateCachedSettings(character, { moduleAssetsEnabled: Boolean(value) });
    runtime.moduleAssetCache = { key: '', at: 0, rows: [] };
  }

  async function setLorebookEncounterEnabled(character, value) {
    await Risuai.pluginStorage.setItem(`lorebookEncounterEnabled:${settingsId(character)}`, value ? '1' : '0');
    updateCachedSettings(character, { lorebookEncounterEnabled: Boolean(value) });
    runtime.lorebookAutoFingerprint = '';
  }

  const AUX_LABELS = { off: '끔', missing: '누락 시', always: '항상 검토' };
  const RARITY_MODE_LABELS = { world: '세계관 우선', itemx: 'ITEMX 강제' };

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
    const source = String(content || '');
    if (!OWNED_TRANSPORT_HINT_RE.test(source)) return source;
    return stripAllTransport(source)
      .replace(ITEMX_REF_RE, '')
      .replace(ITEMX_CODEX_REF_RE, '')
      .replace(/\[(?:itemx|아이템)\s*:[^\]\r\n]{0,2048}\]/gi, '');
  }
  function characterAssetFingerprint(character) {
    const additional = character?.additionalAssets || [],
      emotions = character?.emotionImages || [],
      cc = character?.ccAssets || [];
    const last = additional[additional.length - 1];
    return `${additional.length}:${emotions.length}:${cc.length}:${additional[0]?.[0] || ''}:${last?.[0] || ''}:${cc[0]?.name || ''}`;
  }

  function characterPortraitAssets(character, max = ITEMXCodex.ASSET_CATALOG_MAX) {
    const key = `${character?.chaId || character?.id || 'character'}:${characterAssetFingerprint(character)}`;
    if (runtime.characterAssetCache.key === key && Date.now() - runtime.characterAssetCache.at < 30000)
      return runtime.characterAssetCache.rows;
    const rows = ITEMXCodex.assetCatalog(character, max, true);
    ITEMXCodex.portraitAssetIndex(rows);
    runtime.characterAssetCache = { key, at: Date.now(), rows };
    return rows;
  }

  function combinedPortraitAssets(character, moduleAssets = [], max = ITEMXCodex.ASSET_CATALOG_MAX) {
    const extra = characterPortraitAssets(character, max);
    if (!extra.length) {
      const rows = moduleAssets || [];
      return rows.length <= max ? rows : rows.slice(0, max);
    }
    if (!moduleAssets?.length) return extra.length <= max ? extra : extra.slice(0, max);
    const combinedKey = `${runtime.characterAssetCache.key}|${runtime.moduleAssetCache.key}|${extra.length}|${moduleAssets.length}`;
    if (runtime.combinedAssetCache.key === combinedKey && Date.now() - runtime.combinedAssetCache.at < 30000)
      return runtime.combinedAssetCache.rows;
    const rows = extra.slice(),
      seen = new Set(rows.map((row) => row.name));
    for (const row of moduleAssets) {
      if (rows.length >= max || !row?.name || !row?.id || seen.has(row.name)) continue;
      seen.add(row.name);
      rows.push(row);
    }
    ITEMXCodex.portraitAssetIndex(rows);
    runtime.combinedAssetCache = { key: combinedKey, at: Date.now(), rows };
    return rows;
  }

  function encounterEntities(snapshot) {
    const monsters = snapshot?.monsters;
    return (monsters?.order || []).map((id) => monsters.entries?.[id]).filter(Boolean);
  }

  function encounterRegistryFingerprint(snapshot) {
    const monsters = snapshot?.monsters;
    const rows = (monsters?.order || []).map((id) => monsters.entries?.[id]).filter(Boolean);
    return ITEMXCore.fnv1a(JSON.stringify(rows));
  }

  async function modulePortraitAssets(settings, character, chat) {
    if (!settings?.moduleAssetsEnabled || typeof Risuai.getDatabase !== 'function') return [];
    const key = `${character?.chaId || character?.id || 'character'}:${chat?.id || 'chat'}`;
    if (runtime.moduleAssetCache.key === key && Date.now() - runtime.moduleAssetCache.at < 30000)
      return runtime.moduleAssetCache.rows;
    try {
      const database = await Risuai.getDatabase([
        'modules',
        'enabledModules',
        'moduleIntergration',
        'personas',
        'selectedPersona'
      ]);
      if (!database) {
        runtime.permissions.db = false;
        runtime.moduleAssetCache = { key, at: Date.now(), rows: [] };
        return [];
      }
      runtime.permissions.db = true;
      const rows = ITEMXCodex.activeModuleAssetCatalog(database, character, chat, ITEMXCodex.ASSET_CATALOG_MAX);
      ITEMXCodex.portraitAssetIndex(rows);
      runtime.moduleAssetCache = { key, at: Date.now(), rows };
      return rows;
    } catch (error) {
      runtime.permissions.db = false;
      runtime.moduleAssetCache = { key, at: Date.now(), rows: [] };
      debugRecord('module portrait assets', error?.message || String(error));
      return [];
    }
  }

  async function enableModuleAssets(character, chat) {
    if (typeof Risuai.getDatabase !== 'function') return false;
    try {
      if (
        typeof Risuai.requestPluginPermission === 'function' &&
        (await Risuai.requestPluginPermission('db')) !== true
      ) {
        runtime.permissions.db = false;
        return false;
      }
      const probe = await Risuai.getDatabase([
        'modules',
        'enabledModules',
        'moduleIntergration',
        'personas',
        'selectedPersona'
      ]);
      if (!probe) {
        runtime.permissions.db = false;
        return false;
      }
      runtime.permissions.db = true;
      await setModuleAssetsEnabled(character, true);
      const rows = ITEMXCodex.activeModuleAssetCatalog(probe, character, chat, ITEMXCodex.ASSET_CATALOG_MAX);
      ITEMXCodex.portraitAssetIndex(rows);
      runtime.moduleAssetCache = {
        key: `${character?.chaId || character?.id || 'character'}:${chat?.id || 'chat'}`,
        at: Date.now(),
        rows
      };
      return true;
    } catch (error) {
      runtime.permissions.db = false;
      debugRecord('module portrait permission', error?.message || String(error));
      return false;
    }
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

  const BADGE_POSITIONS = [
    ['lb', '좌하'],
    ['lm', '좌중'],
    ['lt', '좌상'],
    ['rb', '우하'],
    ['rm', '우중'],
    ['rt', '우상']
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
    const button =
      'button[aria-label="ITEMX CODEX"],button[aria-label="ITEMX"],button:has(img[src*="ITEMX%20CODEX"]),button:has(img[src*="ITEMX%20inventory"])';
    const states =
      'button[aria-label="ITEMX CODEX"]:hover,button[aria-label="ITEMX CODEX"]:active,button[aria-label="ITEMX CODEX"]:focus,button[aria-label="ITEMX"]:hover,button[aria-label="ITEMX"]:active,button[aria-label="ITEMX"]:focus,button:has(img[src*="ITEMX%20CODEX"]):hover,button:has(img[src*="ITEMX%20CODEX"]):active,button:has(img[src*="ITEMX%20CODEX"]):focus,button:has(img[src*="ITEMX%20inventory"]):hover,button:has(img[src*="ITEMX%20inventory"]):active,button:has(img[src*="ITEMX%20inventory"]):focus';
    const wrappers =
      'button[aria-label="ITEMX CODEX"]>div,button[aria-label="ITEMX"]>div,button:has(img[src*="ITEMX%20CODEX"])>div,button:has(img[src*="ITEMX%20inventory"])>div';
    const images =
      'button[aria-label="ITEMX CODEX"] img,button[aria-label="ITEMX"] img,button:has(img[src*="ITEMX%20CODEX"]) img[src*="ITEMX%20CODEX"],button:has(img[src*="ITEMX%20inventory"]) img[src*="ITEMX%20inventory"]';
    return `${button}{${positions[runtime.badgePosition] || positions.rm};display:flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;width:48px!important;height:176px!important;min-width:48px!important;min-height:176px!important;padding:0!important;overflow:visible!important;border:0!important;outline:0!important;background:none!important;background-color:transparent!important;box-shadow:none!important;cursor:pointer!important;touch-action:manipulation!important;z-index:50!important}${states}{background:none!important;background-color:transparent!important;box-shadow:none!important}${wrappers}{display:block!important;box-sizing:border-box!important;width:48px!important;height:176px!important;min-width:48px!important;min-height:176px!important;padding:0!important;overflow:visible!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important}${images}{display:block!important;box-sizing:border-box!important;width:48px!important;height:176px!important;min-width:48px!important;min-height:176px!important;max-width:48px!important;max-height:176px!important;border-radius:0!important;object-fit:contain!important}`;
  }

  const codexPageStyle = () => `
.itemx-codex-page-active{display:grid!important}
.itemx2-codex-detail-index{display:none!important}
.itemx2-codex-card{position:relative;display:block;min-height:70px;border:1px solid #263247;border-radius:12px;background:linear-gradient(145deg,#121a28,#0b111b);overflow:hidden}.itemx2-codex-summary{position:relative;z-index:1;display:grid;grid-template-columns:48px minmax(0,1fr) minmax(72px,auto);gap:10px;align-items:center;min-height:70px;padding:10px;cursor:pointer}.itemx2-codex-glyph{display:grid;place-items:center;width:48px;height:48px;border:1px solid #40506b;border-radius:11px;background:#0b111c;color:#dbe8ff;font-size:1.2rem}.itemx2-codex-copy{display:grid;gap:3px;min-width:0}.itemx2-codex-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#edf2fb;font-size:.82rem}.itemx2-codex-copy small{color:#8494ad;font-size:.66rem}.itemx2-codex-tags{display:flex;flex-wrap:wrap;gap:4px}.itemx2-codex-tags i{padding:2px 5px;border:1px solid #344259;border-radius:999px;color:#aebbd0;font-size:.58rem;font-style:normal}.itemx2-skill-meta{display:grid;grid-template-columns:auto auto;gap:2px 5px;align-items:center;padding:6px 7px;border:1px solid #2e3a50;border-radius:9px;background:rgba(9,14,23,.82);font-size:.58rem}.itemx2-skill-meta small{color:#6f809a}.itemx2-skill-meta b{color:#dce6f5;font-size:.62rem;text-align:right}.itemx2-mastery{grid-column:2/-1;display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.itemx2-mastery i{height:5px;border-radius:6px;background:#202a3a}.itemx2-mastery i.on{background:linear-gradient(90deg,#66b8ff,#a985ff);box-shadow:0 0 8px rgba(102,184,255,.35)}.itemx2-bestiary-card.active{border-color:#70404a;box-shadow:inset 3px 0 #b55b68}.itemx2-bestiary-card img{width:48px;height:48px;border-radius:11px;object-fit:cover}
.itemx-codex-list{display:grid;gap:9px}.itemx-codex-list-button{width:100%;padding:0;border:0;color:inherit;text-align:left;font:inherit}.itemx2-codex-summary::after{content:'›';position:absolute;right:9px;bottom:5px;color:#71839f;font-size:.85rem;font-weight:900}.itemx-codex-page{position:relative;display:grid;gap:11px;min-height:100%;padding:2px 0 14px;animation:itemx-codex-page-in .22s cubic-bezier(.2,.78,.2,1) both}.itemx2-codex-page{display:none}.itemx2-codex-entry-choice:checked~.itemx2-codex-summary{display:none}.itemx2-codex-entry-choice:checked~.itemx2-codex-page{display:grid}.itemx2-root-skills:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-note,.itemx2-root-bestiary:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-note{display:none}.itemx2-root-skills:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-entry:not(:has(.itemx2-codex-entry-choice:checked)),.itemx2-root-bestiary:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-entry:not(:has(.itemx2-codex-entry-choice:checked)){display:none}.itemx-codex-back{justify-self:start;display:inline-flex;align-items:center;min-height:34px;padding:0 10px;border:1px solid #2d3a50;border-radius:9px;background:#101824;color:#c8d4e7;cursor:pointer;font:inherit;font-size:.7rem;font-weight:800}.itemx-codex-hero{position:relative;isolation:isolate;display:grid;place-items:center;min-height:218px;padding:24px 18px 20px;overflow:hidden;border:1px solid #33435d;border-radius:17px;background:radial-gradient(circle at 50% 45%,rgba(91,150,255,.19),transparent 31%),linear-gradient(145deg,#121b2b,#080d16 70%);box-shadow:inset 0 0 45px rgba(63,116,205,.1),0 12px 34px rgba(0,0,0,.32)}.itemx-codex-hero::before,.itemx-codex-hero::after{content:'';position:absolute;left:50%;top:44%;z-index:-1;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}.itemx-codex-hero::before{width:158px;height:158px;border:1px solid rgba(113,181,255,.34);background:repeating-conic-gradient(from 0deg,rgba(128,195,255,.28) 0 2deg,transparent 2deg 28deg);mask:radial-gradient(circle,transparent 53%,#000 54% 58%,transparent 59%);animation:itemx-codex-orbit 8s linear infinite}.itemx-codex-hero::after{width:112px;height:112px;border:1px solid rgba(173,139,255,.32);box-shadow:0 0 42px rgba(76,142,255,.2),inset 0 0 26px rgba(151,105,255,.12);animation:itemx-codex-orbit-reverse 5.5s linear infinite}.itemx-codex-hero-glyph{position:relative;z-index:2;display:grid;place-items:center;width:82px;height:82px;border:1px solid rgba(177,210,255,.55);border-radius:24px;background:radial-gradient(circle at 45% 38%,#263e62,#101827 68%);box-shadow:0 0 25px rgba(94,164,255,.28),inset 0 0 22px rgba(132,184,255,.16);color:#eff7ff;font-size:2.6rem;text-shadow:0 0 14px rgba(142,202,255,.8)}.itemx-codex-hero-copy{position:relative;z-index:2;display:grid;gap:5px;margin-top:18px;text-align:center}.itemx-codex-hero-copy small{color:#8fa4c4;font-size:.65rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.itemx-codex-hero-copy strong{color:#f3f7ff;font-size:1.08rem}.itemx-codex-hero-copy span{color:#9eb0ca;font-size:.68rem}.itemx-codex-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.itemx-codex-stat{display:grid;gap:4px;min-height:60px;padding:10px;border:1px solid #26344a;border-radius:11px;background:linear-gradient(145deg,#111a28,#0b111b)}.itemx-codex-stat small{color:#70819b;font-size:.59rem;font-weight:800}.itemx-codex-stat strong{color:#e8effa;font-size:.72rem;overflow-wrap:anywhere}.itemx-codex-section{display:grid;gap:7px;padding:12px;border:1px solid #243147;border-radius:12px;background:#0c131e;color:#becadd;font-size:.7rem;line-height:1.58}.itemx-codex-section h4{margin:0;color:#d9e6f8;font-size:.67rem;letter-spacing:.08em}.itemx-codex-section p{margin:0;white-space:pre-wrap}.itemx-codex-chip-row{display:flex;flex-wrap:wrap;gap:5px}.itemx-codex-chip-row i{padding:4px 7px;border:1px solid #34445e;border-radius:999px;background:#111a28;color:#b8c7dd;font-size:.61rem;font-style:normal}.itemx-codex-mastery{display:grid;grid-template-columns:repeat(10,1fr);gap:4px}.itemx-codex-mastery i{height:7px;border-radius:999px;background:#202b3c}.itemx-codex-mastery i.on{background:linear-gradient(90deg,#5cbcff,#a978ff);box-shadow:0 0 9px rgba(92,188,255,.42)}.itemx-monster-hero{border-color:#623743;background:radial-gradient(circle at 50% 40%,rgba(222,62,88,.2),transparent 34%),repeating-linear-gradient(0deg,transparent 0 22px,rgba(179,63,79,.035) 23px),linear-gradient(145deg,#211018,#090d14 72%);box-shadow:inset 0 0 54px rgba(190,39,64,.12),0 12px 34px rgba(0,0,0,.38)}.itemx-monster-hero::before{width:174px;height:174px;border-color:rgba(255,99,123,.36);background:repeating-conic-gradient(from 0deg,rgba(255,86,112,.32) 0 1.5deg,transparent 1.5deg 22deg);animation-duration:11s}.itemx-monster-hero::after{left:50%;top:18%;width:100%;height:2px;border:0;border-radius:0;background:linear-gradient(90deg,transparent,#ff667e,transparent);box-shadow:0 0 18px rgba(255,62,92,.7);transform:translate3d(-50%,0,0);will-change:transform,opacity;animation:itemx-codex-scan 3.2s ease-in-out infinite}.itemx-monster-portrait{position:relative;z-index:2;width:112px;height:112px;border:1px solid rgba(255,124,143,.58);border-radius:18px;object-fit:cover;box-shadow:0 0 0 5px rgba(93,24,35,.35),0 0 32px rgba(255,65,94,.3);filter:saturate(.86) contrast(1.06)}.itemx-monster-hero .itemx-codex-hero-glyph{border-color:rgba(255,124,143,.54);background:radial-gradient(circle at 45% 38%,#5a2632,#1b1018 70%);box-shadow:0 0 28px rgba(255,60,91,.3),inset 0 0 22px rgba(255,111,131,.12)}.itemx-threat-banner{position:absolute;left:10px;top:10px;z-index:3;padding:5px 8px;border:1px solid rgba(255,109,130,.48);border-radius:999px;background:rgba(41,10,17,.82);color:#ff9aab;font-size:.58rem;font-weight:900;letter-spacing:.12em}@keyframes itemx-codex-page-in{from{opacity:0;transform:translate3d(12px,0,0)}to{opacity:1;transform:none}}@keyframes itemx-codex-orbit{to{transform:translate(-50%,-50%) rotate(360deg)}}@keyframes itemx-codex-orbit-reverse{to{transform:translate(-50%,-50%) rotate(-360deg)}}@keyframes itemx-codex-scan{0%,100%{opacity:.2;transform:translate3d(-50%,0,0)}50%{opacity:1;transform:translate3d(-50%,132px,0)}}.itemx2-effects-off .itemx-fx,.itemx2-effects-off .itemx-cond,.itemx2-effects-off .itemx-codex-hero::before,.itemx2-effects-off .itemx-codex-hero::after,.itemx2-effects-off .itemx2-skill-card::after{display:none!important;animation:none!important}@media(prefers-reduced-motion:reduce){.itemx-codex-page,.itemx-codex-hero::before,.itemx-codex-hero::after{animation:none!important}}
.itemx2-font-small{--itemx-ui-scale:1}.itemx2-font-medium{--itemx-ui-scale:1.12}.itemx2-font-large{--itemx-ui-scale:1.25}.itemx2-font-small,.itemx2-font-medium,.itemx2-font-large{--itemx-text-xs:calc(.62rem * var(--itemx-ui-scale));--itemx-text-sm:calc(.70rem * var(--itemx-ui-scale));--itemx-text-md:calc(.82rem * var(--itemx-ui-scale));--itemx-text-lg:calc(1.08rem * var(--itemx-ui-scale))}.itemx2-codex-copy strong{font-size:var(--itemx-text-md,.82rem)}.itemx-codex-hero-copy strong{font-size:var(--itemx-text-lg,1.08rem)}.itemx-codex-section{font-size:var(--itemx-text-sm,.7rem)}
.itemx2-codex-fx{position:absolute;pointer-events:none;contain:paint;--fx:#78b9ff;--fx2:#a77fff;--fx3:#eef7ff;--fx-speed:8s}.itemx2-codex-list-fx{z-index:0;inset:0;overflow:hidden;opacity:.82;animation:none}.itemx2-codex-hero-fx{z-index:0;inset:0;overflow:hidden}.itemx2-codex-hero-fx i,.itemx2-codex-hero-fx b,.itemx2-codex-hero-fx em{position:absolute;display:block;font-style:normal;pointer-events:none}.itemx-skill-hero::before,.itemx-skill-hero::after{display:none!important}
.itemx2-skill-theme-fire{--fx:#ff7a3d;--fx2:#ffd067}.itemx2-skill-theme-ice{--fx:#72d8f4;--fx2:#a7b9ff}.itemx2-skill-theme-lightning{--fx:#9fc6ff;--fx2:#f2e773}.itemx2-skill-theme-dark{--fx:#9169df;--fx2:#d166df}.itemx2-skill-theme-light{--fx:#f7e6b2;--fx2:#fff}.itemx2-skill-theme-arcane{--fx:#789cff;--fx2:#b07be9}
.itemx2-skill-list-fx{opacity:.44;background:radial-gradient(ellipse at 91% 52%,color-mix(in srgb,var(--fx) 24%,transparent),transparent 39%)}.itemx2-skill-theme-fire.itemx2-skill-list-fx{background:radial-gradient(ellipse at 92% 78%,rgba(255,84,31,.3),transparent 39%),linear-gradient(158deg,transparent 68%,rgba(255,192,75,.16))}.itemx2-skill-theme-ice.itemx2-skill-list-fx{background:linear-gradient(128deg,transparent 69%,rgba(188,242,255,.2) 70% 78%,transparent 79%),radial-gradient(ellipse at 92% 45%,rgba(74,175,223,.17),transparent 38%)}.itemx2-skill-theme-lightning.itemx2-skill-list-fx{background:linear-gradient(117deg,transparent 70%,rgba(242,235,99,.42) 71% 72%,transparent 73% 77%,rgba(125,183,255,.3) 78% 79%,transparent 80%)}.itemx2-skill-theme-dark.itemx2-skill-list-fx{background:radial-gradient(ellipse at 90% 52%,rgba(6,3,14,.8),transparent 42%),radial-gradient(ellipse at 96% 46%,rgba(134,65,180,.24),transparent 33%)}.itemx2-skill-theme-light.itemx2-skill-list-fx{background:radial-gradient(ellipse at 91% 49%,rgba(255,246,214,.28),transparent 40%),linear-gradient(112deg,transparent 73%,rgba(245,216,143,.15))}.itemx2-skill-theme-arcane.itemx2-skill-list-fx{background:radial-gradient(ellipse at 91% 51%,rgba(78,117,211,.22),transparent 39%),radial-gradient(circle at 84% 34%,rgba(189,145,239,.55) 0 1px,transparent 2px),radial-gradient(circle at 95% 70%,rgba(117,189,242,.48) 0 1px,transparent 2px)}
.itemx2-skill-rank-normal.itemx2-skill-list-fx{opacity:.2}.itemx2-skill-rank-magic.itemx2-skill-list-fx{opacity:.34}.itemx2-skill-rank-rare.itemx2-skill-list-fx{opacity:.48}.itemx2-skill-rank-unique.itemx2-skill-list-fx{opacity:.62}.itemx2-skill-rank-epic.itemx2-skill-list-fx{opacity:.72}.itemx2-skill-rank-legendary.itemx2-skill-list-fx,.itemx2-skill-rank-mythical.itemx2-skill-list-fx,.itemx2-skill-rank-empyrean.itemx2-skill-list-fx{opacity:.86}
.itemx-skill-hero{border-color:color-mix(in srgb,var(--rk) 45%,#33435d);background:radial-gradient(ellipse at 50% 46%,color-mix(in srgb,var(--p) 15%,transparent),transparent 38%),linear-gradient(145deg,#141a28,#080c14 74%);box-shadow:inset 0 0 48px color-mix(in srgb,var(--pg) 26%,transparent),0 12px 34px rgba(0,0,0,.38)}.itemx-skill-hero .itemx2-skill-weapon-fx{z-index:0}.itemx-skill-hero .itemx-codex-hero-glyph{width:92px;height:92px;border-color:color-mix(in srgb,var(--rk) 62%,#58667d);border-radius:26px;background:radial-gradient(circle at 43% 36%,color-mix(in srgb,var(--p) 32%,#26364e),#0b111c 70%);box-shadow:0 0 0 4px color-mix(in srgb,var(--rk) 10%,transparent),0 0 34px color-mix(in srgb,var(--pg) 62%,transparent),inset 0 0 24px color-mix(in srgb,var(--p) 18%,transparent);text-shadow:0 0 17px color-mix(in srgb,var(--p) 80%,transparent)}.itemx-skill-hero.itemx2-skill-rank-normal .itemx-fx{opacity:.3}.itemx-skill-hero.itemx2-skill-rank-magic .itemx-fx{opacity:.48}.itemx-skill-hero.itemx2-skill-rank-rare .itemx-fx{opacity:.66}.itemx-skill-hero.itemx2-skill-rank-unique .itemx-fx{opacity:.82}.itemx-skill-hero.itemx2-skill-rank-epic .itemx-fx,.itemx-skill-hero.itemx2-skill-rank-legendary .itemx-fx,.itemx-skill-hero.itemx2-skill-rank-mythical .itemx-fx,.itemx-skill-hero.itemx2-skill-rank-empyrean .itemx-fx{opacity:1}.itemx-skill-hero.itemx2-skill-rank-legendary,.itemx-skill-hero.itemx2-skill-rank-mythical,.itemx-skill-hero.itemx2-skill-rank-empyrean{box-shadow:inset 0 0 58px color-mix(in srgb,var(--pg) 40%,transparent),0 15px 40px rgba(0,0,0,.42),0 0 22px color-mix(in srgb,var(--rk) 18%,transparent)}.itemx2-skill-type-passive .itemx-fx{opacity:.72}.itemx2-skill-type-sealed .itemx-fx,.itemx2-skill-status-sealed .itemx-fx{opacity:.3;filter:saturate(.42) brightness(.68)}.itemx2-skill-status-equipped .itemx-codex-hero-glyph{box-shadow:0 0 0 4px color-mix(in srgb,var(--rk) 16%,transparent),0 0 42px color-mix(in srgb,var(--pg) 78%,transparent),inset 0 0 24px color-mix(in srgb,var(--p) 22%,transparent)}.itemx2-skill-status-lost .itemx-fx{opacity:.12;filter:grayscale(.86) brightness(.5)}.itemx2-skill-status-lost .itemx-fx *{animation:none!important}
.itemx-monster-hero{border-color:#623743;background:radial-gradient(circle at 50% 40%,rgba(222,62,88,.2),transparent 34%),repeating-linear-gradient(0deg,transparent 0 22px,rgba(179,63,79,.035) 23px),linear-gradient(145deg,#211018,#090d14 72%);box-shadow:inset 0 0 54px rgba(190,39,64,.12),0 12px 34px rgba(0,0,0,.38)}.itemx-monster-hero::before{width:174px;height:174px;border-color:rgba(255,99,123,.36);background:repeating-conic-gradient(from 0deg,rgba(255,86,112,.32) 0 1.5deg,transparent 1.5deg 22deg);animation-duration:11s}.itemx-monster-hero::after{left:50%;top:18%;width:100%;height:2px;border:0;border-radius:0;background:linear-gradient(90deg,transparent,#ff667e,transparent);box-shadow:0 0 18px rgba(255,62,92,.7);transform:translate3d(-50%,0,0);animation:itemx-codex-scan 3.2s ease-in-out infinite}.itemx-monster-portrait{filter:saturate(.86) contrast(1.06)}.itemx-monster-hero .itemx-codex-hero-glyph{border-color:rgba(255,124,143,.54);background:radial-gradient(circle at 45% 38%,#5a2632,#1b1018 70%);box-shadow:0 0 28px rgba(255,60,91,.3),inset 0 0 22px rgba(255,111,131,.12)}
.itemx2-encounter-hero-fx{--fx:#bf687a;--fx2:#73849f;--fx-duration:6s}.itemx2-encounter-hero-fx i{inset:12% 18%;border:1px solid color-mix(in srgb,var(--fx) 48%,transparent);border-radius:50%;box-shadow:0 0 30px color-mix(in srgb,var(--fx) 25%,transparent);animation:itemx2-codex-spin var(--fx-duration) linear infinite}.itemx2-encounter-hero-fx b{inset:27% 8%;background:repeating-conic-gradient(from 20deg,color-mix(in srgb,var(--fx2) 32%,transparent) 0 2deg,transparent 2deg 31deg);mask:radial-gradient(circle,transparent 54%,#000 56% 58%,transparent 60%);animation:itemx2-codex-spin calc(var(--fx-duration) * 1.45) linear infinite reverse}.itemx2-encounter-hero-fx em{left:8%;right:8%;bottom:5%;height:34%;background:radial-gradient(ellipse at 50% 100%,color-mix(in srgb,var(--fx) 28%,transparent),transparent 68%);filter:blur(8px);animation:itemx2-codex-breathe calc(var(--fx-duration) * .75) ease-in-out infinite}
.itemx2-encounter-theme-beast{--fx:#e7aa61;--fx2:#d85d4d}.itemx2-encounter-theme-undead{--fx:#8ed9c2;--fx2:#7c62a8}.itemx2-encounter-theme-construct{--fx:#75b9d6;--fx2:#b3ccd4}.itemx2-encounter-theme-dragon{--fx:#ff674b;--fx2:#efb74e}.itemx2-encounter-theme-aquatic{--fx:#49c9dc;--fx2:#557fe9}.itemx2-encounter-theme-insect{--fx:#9bc15e;--fx2:#d8b85a}.itemx2-encounter-theme-humanoid,.itemx2-encounter-theme-unknown{--fx:#bf687a;--fx2:#73849f}.itemx2-encounter-list-fx{opacity:.82;animation:itemx2-codex-breathe 6s ease-in-out infinite}.itemx2-encounter-theme-beast.itemx2-encounter-list-fx{background:linear-gradient(115deg,transparent 68%,color-mix(in srgb,var(--fx) 20%,transparent)),repeating-linear-gradient(70deg,transparent 0 13px,color-mix(in srgb,var(--fx2) 14%,transparent) 14px 15px)}.itemx2-encounter-theme-undead.itemx2-encounter-list-fx,.itemx2-encounter-theme-aquatic.itemx2-encounter-list-fx{background:radial-gradient(ellipse at 85% 80%,color-mix(in srgb,var(--fx) 30%,transparent),transparent 48%)}.itemx2-encounter-theme-construct.itemx2-encounter-list-fx{background:repeating-linear-gradient(90deg,transparent 0 20px,color-mix(in srgb,var(--fx) 11%,transparent) 21px),repeating-linear-gradient(0deg,transparent 0 15px,color-mix(in srgb,var(--fx2) 8%,transparent) 16px)}.itemx2-encounter-theme-dragon.itemx2-encounter-list-fx{background:radial-gradient(circle at 90% 50%,color-mix(in srgb,var(--fx) 32%,transparent),transparent 38%)}.itemx2-encounter-theme-insect.itemx2-encounter-list-fx{background:radial-gradient(circle at 82% 32%,color-mix(in srgb,var(--fx) 30%,transparent) 0 2px,transparent 3px),radial-gradient(circle at 94% 61%,color-mix(in srgb,var(--fx2) 26%,transparent) 0 2px,transparent 3px)}.itemx2-threat-1.itemx2-encounter-list-fx{opacity:.88}.itemx2-threat-2.itemx2-encounter-list-fx,.itemx2-threat-2 .itemx2-encounter-hero-fx{filter:brightness(1.12)}.itemx2-threat-3.itemx2-encounter-list-fx,.itemx2-threat-3 .itemx2-encounter-hero-fx{filter:brightness(1.28) saturate(1.18)}.itemx2-encounter-warning .itemx2-encounter-hero-fx::after{content:'';position:absolute;left:0;right:0;top:12%;height:2px;background:linear-gradient(90deg,transparent,#ff637c,transparent);box-shadow:0 0 16px #ff3d60;animation:itemx2-codex-warning 3s ease-in-out infinite}.itemx2-encounter-sparring{--fx:#6eb8ee;--fx2:#d4b96a}.itemx-monster-hero.itemx2-encounter-ended{border-color:#3f4652;background:radial-gradient(circle at 50% 40%,rgba(118,126,139,.14),transparent 34%),repeating-linear-gradient(0deg,transparent 0 22px,rgba(130,138,150,.025) 23px),linear-gradient(145deg,#171b22,#090d13 72%);box-shadow:inset 0 0 54px rgba(105,115,130,.09),0 12px 34px rgba(0,0,0,.38)}.itemx2-encounter-ended.itemx2-encounter-list-fx,.itemx2-encounter-ended .itemx2-encounter-hero-fx{opacity:.34;filter:grayscale(.65)}.itemx2-encounter-ended .itemx-monster-portrait{opacity:.72;filter:grayscale(.82) saturate(.28) contrast(1.04)}.itemx2-encounter-ended .itemx-codex-hero-copy{opacity:.72}.itemx2-encounter-ended,.itemx2-encounter-ended *{animation-play-state:paused!important}@keyframes itemx2-codex-spin{to{transform:rotate(360deg)}}@keyframes itemx2-codex-breathe{0%,100%{opacity:.42}50%{opacity:1}}@keyframes itemx2-codex-warning{0%,100%{opacity:.15;transform:translateY(0)}50%{opacity:.9;transform:translateY(130px)}}
.itemx-monster-hero.itemx2-encounter-ended::before{border-color:rgba(139,147,160,.22);background:repeating-conic-gradient(from 0deg,rgba(151,159,171,.18) 0 1.5deg,transparent 1.5deg 22deg);animation-play-state:paused!important}.itemx-monster-hero.itemx2-encounter-ended::after,.itemx2-encounter-ended .itemx2-encounter-hero-fx::after{background:linear-gradient(90deg,transparent,#8b94a3,transparent);box-shadow:0 0 14px rgba(125,135,150,.42);animation-play-state:paused!important}
.itemx2-encounter-outcome{position:relative;overflow:hidden;border-color:#453b31;background:radial-gradient(ellipse at 92% 14%,rgba(205,157,76,.11),transparent 42%),linear-gradient(145deg,#151711,#0d1118 72%)}.itemx2-encounter-outcome::after{content:'';position:absolute;right:-18px;bottom:-24px;width:98px;height:72px;border-radius:55% 45% 48% 52%;background:radial-gradient(ellipse,rgba(180,119,57,.13),transparent 68%);pointer-events:none}.itemx2-encounter-outcome-head{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:8px}.itemx2-encounter-outcome-head h4{color:#e8c98d}.itemx2-encounter-outcome-head i{padding:3px 7px;border:1px solid rgba(205,166,98,.28);border-radius:999px;background:rgba(55,43,23,.45);color:#d9bb82;font-size:.58rem;font-style:normal}.itemx2-encounter-outcome p{position:relative;z-index:1;color:#d3d8df}
@keyframes itemx2-fire-breathe{from{opacity:.52;transform:translate3d(-2px,5px,0) scale(.96,1)}to{opacity:.88;transform:translate3d(3px,-4px,0) scale(1.04,1.06)}}@keyframes itemx2-fire-embers{from{opacity:.2;transform:translate3d(0,12px,0)}45%{opacity:.8}to{opacity:.08;transform:translate3d(5px,-20px,0)}}@keyframes itemx2-ice-float{from{opacity:.42;transform:translate3d(-3px,3px,0) rotate(-1.2deg)}to{opacity:.68;transform:translate3d(3px,-3px,0) rotate(1.4deg)}}@keyframes itemx2-lightning-quiet{0%,15%,19%,71%,75%,100%{opacity:.45}16%,18%,72%,74%{opacity:.9}}@keyframes itemx2-lightning-strike{0%,12%,17%,63%,68%,100%{opacity:.08}13%,16%,64%,67%{opacity:.84}}@keyframes itemx2-dark-draw{from{opacity:.35;transform:translate3d(-3px,1px,0) scale(1.04)}to{opacity:.66;transform:translate3d(4px,-2px,0) scale(.94)}}@keyframes itemx2-light-drift{from{opacity:.3;transform:translate3d(-2px,2px,0) scale(.98)}to{opacity:.64;transform:translate3d(3px,-2px,0) scale(1.03)}}@keyframes itemx2-arcane-parallax{from{opacity:.38;transform:translate3d(-3px,2px,0)}to{opacity:.68;transform:translate3d(4px,-3px,0)}}@keyframes itemx2-undead-haze{from{opacity:.32;transform:translate3d(-5px,2px,0)}to{opacity:.58;transform:translate3d(6px,-2px,0)}}@keyframes itemx2-construct-scan{0%,100%{opacity:.18;transform:translateY(-20px)}50%{opacity:.78;transform:translateY(116px)}}@keyframes itemx2-aquatic-caustic{from{opacity:.34;transform:translate3d(-3px,2px,0)}to{opacity:.6;transform:translate3d(4px,-3px,0)}}@keyframes itemx2-insect-drift{from{opacity:.35;transform:translate3d(-3px,2px,0)}to{opacity:.57;transform:translate3d(4px,-2px,0)}}@keyframes itemx2-combat-warning{0%,100%{opacity:.12;transform:translateY(0)}50%{opacity:.78;transform:translateY(132px)}}
.itemx2-effects-off .itemx2-codex-fx{display:none!important;animation:none!important}.itemx2-effects-off .itemx2-codex-fx *{animation:none!important}@media(prefers-reduced-motion:reduce){.itemx2-codex-fx,.itemx2-codex-fx *,.itemx2-skill-weapon-fx,.itemx2-skill-weapon-fx *{animation:none!important}}
`;

  const rootDrawerStyle = () => `
.itemx2-root-drawer,.itemx2-root-drawer *{box-sizing:border-box}
.itemx2-root-drawer{--itemx-ui-scale:1;--itemx-text-xs:calc(.62rem * var(--itemx-ui-scale));--itemx-text-sm:calc(.70rem * var(--itemx-ui-scale));--itemx-text-md:calc(.82rem * var(--itemx-ui-scale));--itemx-text-lg:calc(1.08rem * var(--itemx-ui-scale));position:fixed;inset:0;z-index:49;pointer-events:none;font-family:Inter,Pretendard,"Noto Sans KR",sans-serif;color:#e6ebf4}.itemx2-root-drawer.itemx2-font-medium{--itemx-ui-scale:1.12}.itemx2-root-drawer.itemx2-font-large{--itemx-ui-scale:1.25}
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
.itemx2-root-drawer .itemx2-root-panel{position:fixed;display:flex;flex-direction:column;width:min(420px,calc(100vw - 66px));height:min(700px,72dvh);max-height:calc(100dvh - 24px);margin:0;overflow:hidden;pointer-events:auto;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.58)}
.itemx2-root-pos-lb{left:60px;bottom:12px}.itemx2-root-pos-lm{left:60px;top:50%;transform:translateY(-50%)}.itemx2-root-pos-lt{left:60px;top:12px}
.itemx2-root-pos-rb{right:60px;bottom:12px}.itemx2-root-pos-rm{right:60px;top:50%;transform:translateY(-50%)}.itemx2-root-pos-rt{right:60px;top:12px}
.itemx2-root-drawer.itemx2-is-open .itemx2-root-panel{animation:itemx2-root-in .19s cubic-bezier(.2,.78,.2,1) both}.itemx2-root-drawer:not(.itemx2-is-open) .itemx2-root-layer{opacity:0;visibility:hidden;transition:opacity .14s ease,visibility 0s .14s}
.itemx2-root-drawer:not(.itemx2-is-open) .itemx2-root-panel{pointer-events:none;animation:itemx2-root-out .14s ease both}
.itemx2-root-drawer:not(.itemx2-is-open) .itemx-card *{animation-play-state:paused!important}
.itemx2-root-close,.itemx2-root-back{cursor:pointer}.itemx2-root-empty{padding:2rem;text-align:center;color:#77839c}
.itemx-main-tabs{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #171d2b}.itemx-main-tab{min-height:44px;display:grid;place-items:center;border-bottom:2px solid transparent;background:#0d121c;color:#77839c;cursor:pointer;font-size:.72rem;font-weight:800}
.itemx2-root-skills,.itemx2-root-bestiary{display:none;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:12px;background:#090e16}.itemx2-tab-skills:checked~.itemx2-root-layer .itemx2-root-inventory,.itemx2-tab-skills:checked~.itemx2-root-layer .itemx2-root-settings,.itemx2-tab-bestiary:checked~.itemx2-root-layer .itemx2-root-inventory,.itemx2-tab-bestiary:checked~.itemx2-root-layer .itemx2-root-settings{display:none}.itemx2-tab-skills:checked~.itemx2-root-layer .itemx2-root-skills,.itemx2-tab-bestiary:checked~.itemx2-root-layer .itemx2-root-bestiary{display:grid;align-content:start;gap:9px}.itemx2-tab-inventory:checked~.itemx2-root-layer label[for="itemx2-tab-inventory"],.itemx2-tab-skills:checked~.itemx2-root-layer label[for="itemx2-tab-skills"],.itemx2-tab-bestiary:checked~.itemx2-root-layer label[for="itemx2-tab-bestiary"],.itemx2-tab-settings:checked~.itemx2-root-layer label[for="itemx2-tab-settings"]{border-bottom-color:#d4af6e;color:#f3dcaa;background:#121925}
.itemx2-codex-card{position:relative;display:block;min-height:70px;border:1px solid #263247;border-radius:12px;background:linear-gradient(145deg,#121a28,#0b111b);overflow:hidden}.itemx2-codex-summary{position:relative;z-index:1;display:grid;grid-template-columns:48px minmax(0,1fr) minmax(72px,auto);gap:10px;align-items:center;min-height:70px;padding:10px;cursor:pointer;list-style:none}.itemx2-codex-summary::-webkit-details-marker{display:none}.itemx2-codex-summary::after{content:'＋';position:absolute;right:8px;bottom:5px;color:#66758d;font-size:var(--itemx-text-sm,.7rem)}.itemx2-codex-card[open]>.itemx2-codex-summary::after{content:'－';color:#d4af6e}.itemx2-codex-glyph{display:grid;place-items:center;width:48px;height:48px;border:1px solid #40506b;border-radius:11px;background:#0b111c;color:#dbe8ff;font-size:1.45rem}.itemx2-codex-copy{display:grid;gap:3px;min-width:0}.itemx2-codex-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#edf2fb;font-size:var(--itemx-text-md,.82rem)}.itemx2-codex-copy small{color:#8494ad;font-size:var(--itemx-text-xs,.66rem)}.itemx2-codex-tags{display:flex;flex-wrap:wrap;gap:4px}.itemx2-codex-tags i{padding:2px 5px;border:1px solid #344259;border-radius:999px;color:#aebbd0;font-size:calc(var(--itemx-text-xs,.62rem) * .94);font-style:normal}.itemx2-codex-detail{position:relative;z-index:1;display:grid;gap:8px;padding:10px 12px 12px;border-top:1px solid #202b3c;background:rgba(7,11,18,.72);color:#b8c4d7;font-size:var(--itemx-text-sm,.68rem);line-height:1.55}.itemx2-codex-detail p{margin:0;color:#c8d2e1;white-space:pre-wrap}.itemx2-codex-detail-row{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px}.itemx2-codex-detail-row b{color:#74849d;font-size:var(--itemx-text-xs,.62rem)}.itemx2-codex-detail-row span{overflow-wrap:anywhere}.itemx2-skill-meta{position:relative;z-index:1;display:grid;grid-template-columns:auto auto;gap:2px 5px;align-items:center;padding:6px 7px;border:1px solid #2e3a50;border-radius:9px;background:rgba(9,14,23,.82);font-size:var(--itemx-text-xs,.58rem)}.itemx2-skill-meta small{color:#6f809a}.itemx2-skill-meta b{color:#dce6f5;font-size:var(--itemx-text-xs,.62rem);text-align:right}.itemx2-mastery{grid-column:2/-1;display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.itemx2-mastery i{height:5px;border-radius:6px;background:#202a3a;overflow:hidden}.itemx2-mastery i.on{background:linear-gradient(90deg,#66b8ff,#a985ff);box-shadow:0 0 8px rgba(102,184,255,.35)}.itemx2-bestiary-card.active{border-color:#70404a;box-shadow:inset 3px 0 #b55b68}.itemx2-bestiary-card img{width:48px;height:48px;border-radius:11px;object-fit:cover}.itemx2-codex-empty{padding:34px 16px;text-align:center;color:#6f7e96;font-size:var(--itemx-text-sm,.75rem)}.itemx2-codex-note{padding:9px 10px;border:1px solid #1c2635;border-radius:9px;background:#0c121c;color:#8594aa;font-size:var(--itemx-text-xs,.66rem);line-height:1.45}.itemx2-root-drawer.itemx2-font-large .itemx2-codex-card,.itemx2-root-drawer.itemx2-font-large .itemx2-codex-summary{min-height:76px}
.itemx-tile,.itemx2-codex-card{content-visibility:auto;contain:layout paint style}.itemx-tile{contain-intrinsic-size:92px}.itemx2-codex-card{contain-intrinsic-size:78px}
.itemx2-root-inventory{display:flex;flex:1;min-height:0;flex-direction:column;overflow:hidden}.itemx2-root-inventory>.itemx-body{flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding-bottom:calc(.95em + env(safe-area-inset-bottom,0px))}
.itemx2-root-inventory>.itemx-pf{display:flex;align-items:center;justify-content:space-between;gap:8px}.itemx2-root-pager{display:inline-flex;align-items:center;gap:7px}.itemx2-root-pager button{width:30px;height:28px;border:1px solid #2d394c;border-radius:7px;background:#151d2a;color:#d9e4f3;font:inherit;font-weight:900}.itemx2-root-pager button:disabled{opacity:.3}.itemx2-root-pager b{min-width:42px;color:#9eabc0;font-size:.65rem;text-align:center}
.itemx2-root-item{display:block}.itemx2-root-tile-label{display:block;cursor:pointer}.itemx2-root-tile-label .itemx-tile{width:100%;pointer-events:none}
.itemx2-root-detail{display:none}.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-filters,.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-tools,.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx-pf{display:none}
.itemx2-root-settings{display:none;flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px))}.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-inventory,.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-skills,.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-bestiary{display:none}.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-settings{display:grid;gap:10px}
.itemx2-root-tab-body{display:flex;flex:1;min-height:0;flex-direction:column;overflow:hidden}.itemx2-root-tab-body>.itemx2-root-skills,.itemx2-root-tab-body>.itemx2-root-bestiary{display:grid;align-content:start;gap:9px}.itemx2-root-tab-body>.itemx2-root-settings{display:grid;gap:10px}.itemx-main-tab-on{border-bottom-color:#d4af6e!important;color:#f3dcaa!important;background:#121925!important}.itemx2-tab-loading{display:grid;flex:1;min-height:0;place-content:center;justify-items:center;gap:10px;padding:24px;color:#b7c3d6;text-align:center}.itemx2-tab-loading i{width:28px;height:28px;border:2px solid rgba(212,175,110,.2);border-top-color:#d4af6e;border-radius:50%;animation:itemx2-tab-spin .7s linear infinite}.itemx2-tab-loading strong{color:#f0dfb8;font-size:.78rem}.itemx2-tab-loading small{color:#718097;font-size:.66rem}@keyframes itemx2-tab-spin{to{transform:rotate(360deg)}}
.itemx2-position-grid,.itemx2-font-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.itemx2-position-choice,.itemx2-font-choice{display:grid;place-items:center;min-height:38px;border:1px solid #2b3547;border-radius:9px;background:#151d2a;color:#9aabc4;cursor:pointer}.itemx2-pos-lb:checked~.itemx2-root-layer label[for="itemx2-pos-lb"],.itemx2-pos-lm:checked~.itemx2-root-layer label[for="itemx2-pos-lm"],.itemx2-pos-lt:checked~.itemx2-root-layer label[for="itemx2-pos-lt"],.itemx2-pos-rb:checked~.itemx2-root-layer label[for="itemx2-pos-rb"],.itemx2-pos-rm:checked~.itemx2-root-layer label[for="itemx2-pos-rm"],.itemx2-pos-rt:checked~.itemx2-root-layer label[for="itemx2-pos-rt"]{border-color:#d4af6e;background:#292316;color:#f3dcaa}
.itemx2-font-choice.itemx2-font-on{border-color:#d4af6e;background:#292316;color:#f3dcaa}
.itemx2-position-on{border-color:#d4af6e;background:#292316;color:#f3dcaa}
.itemx2-root-setting-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;border:1px solid #1c2331;border-radius:12px;background:#0d121c}.itemx2-root-setting-card span{display:grid;gap:3px}.itemx2-root-setting-card small{color:#77839c;line-height:1.4}.itemx2-root-setting-button{min-height:36px;padding:0 11px;border:1px solid #2b3547;border-radius:9px;background:#151d2a;color:#cbd7e9;cursor:pointer}
.itemx2-status-row{display:flex!important;flex-direction:row!important;flex-wrap:wrap;gap:5px!important;margin-top:3px}.itemx2-status-chip{display:inline-flex!important;padding:3px 7px;border:1px solid #354157;border-radius:999px;background:#131a26;color:#93a2ba;font-size:.66rem;font-weight:800;font-style:normal}.itemx2-status-chip-on{border-color:#37634d;color:#9cddb7;background:#102019}.itemx2-status-chip-warn{border-color:#6a5530;color:#e8c987;background:#241d10}.itemx2-status-chip-off{border-color:#61343a;color:#efa8af;background:#251216}.itemx2-root-setting-button-primary{border-color:#6e5a32;background:#2a2316;color:#f0d79d}.itemx2-setting-on{border-color:#4e8968!important;background:#12241a!important;color:#a9e6c2!important}.itemx2-setting-cleanup{border-color:#65333a!important;background:#241216!important;color:#ffadb5!important}.itemx2-setting-cleanup-armed{box-shadow:0 0 0 1px #b85b67 inset!important}.itemx2-root-setting-button:disabled,.itemx2-root-setting-button-busy{opacity:.58;cursor:default;pointer-events:none}.itemx2-aux-status-done i,.itemx2-aux-status-failed i{border:0!important;animation:none!important}.itemx2-aux-status-done i::before{content:'✓';color:#9cddb7;font-style:normal;font-weight:900}.itemx2-aux-status-failed i::before{content:'!';color:#ffadb5;font-style:normal;font-weight:900}
.itemx2-manager-fold{border:1px solid #283247;border-radius:12px;background:#0b1019;overflow:hidden}.itemx2-manager-fold summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px;cursor:pointer;color:#f0d79d;font-weight:800;list-style:none}.itemx2-manager-fold summary::-webkit-details-marker{display:none}.itemx2-manager-fold summary::after{content:'＋';color:#8291aa}.itemx2-manager-fold[open] summary::after{content:'－'}.itemx2-manager-body{display:grid;gap:10px;padding:0 12px 12px}.itemx2-manager-label{display:grid;gap:5px;color:#8592a8;font-size:.72rem}.itemx2-manager-editor{min-height:58px;padding:9px;border:1px solid #293448;border-radius:9px;background:#121925;color:#e3e9f3;white-space:pre-wrap;overflow-wrap:anywhere;outline:none}.itemx2-manager-editor:focus{border-color:#637ba3}.itemx2-manager-list{display:grid;gap:7px}.itemx2-manager-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px;border:1px solid #1d2737;border-radius:9px;background:#101722}.itemx2-manager-name{display:grid;gap:2px;min-width:0}.itemx2-manager-name strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e9eef7;font-size:.78rem}.itemx2-manager-name small{color:#6f7e96;font-size:.67rem}.itemx2-manager-actions{display:flex;gap:5px}.itemx2-manager-actions button{min-height:31px;padding:0 8px;border:1px solid #344159;border-radius:7px;background:#172131;color:#cbd7e9;cursor:pointer}.itemx2-manager-actions .itemx2-manager-remove{border-color:#65333a;color:#ffadb5}.itemx2-manager-create{display:grid;gap:7px;padding-top:3px;border-top:1px solid #1d2737}
.itemx2-domain-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.itemx2-domain-card{display:grid;gap:5px;padding:10px;border:1px solid #273247;border-radius:10px;background:#101722;color:#dce5f2;text-align:left}.itemx2-domain-card small{color:#718199;font-size:.62rem}.itemx2-debug-fold{border-color:#334056}.itemx2-debug-body{display:grid;gap:8px;padding:0 12px 12px}.itemx2-debug-grid{display:grid;grid-template-columns:72px minmax(0,1fr);gap:5px 8px;font-size:.64rem}.itemx2-debug-grid b{color:#718199}.itemx2-debug-grid span{color:#c4cfdf;overflow-wrap:anywhere}.itemx2-debug-log{display:grid;gap:4px;max-height:180px;overflow:auto;padding:8px;border:1px solid #202b3d;border-radius:8px;background:#080d15;color:#91a2ba;font:10px/1.45 monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-item{display:none}.itemx2-root-panel .itemx2-root-item:has(.itemx2-root-detail-choice:checked){display:block}.itemx2-root-detail-choice:checked~.itemx2-root-tile-label{display:none}.itemx2-root-detail-choice:checked~.itemx2-root-detail{display:block}
.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx-grid{grid-template-columns:minmax(0,1fr)}.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-item:has(.itemx2-root-detail-choice:checked){grid-column:1/-1;width:100%;min-width:0}.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx-detail{width:100%}
.itemx2-root-filter-owned:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-owned),.itemx2-root-filter-equipped:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-equipped),.itemx2-root-filter-observed:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-observed),.itemx2-root-filter-removed:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-removed){display:none}
.itemx2-root-filter-all:checked~.itemx2-root-layer label[for="itemx2-filter-all"],.itemx2-root-filter-owned:checked~.itemx2-root-layer label[for="itemx2-filter-owned"],.itemx2-root-filter-equipped:checked~.itemx2-root-layer label[for="itemx2-filter-equipped"],.itemx2-root-filter-observed:checked~.itemx2-root-layer label[for="itemx2-filter-observed"],.itemx2-root-filter-removed:checked~.itemx2-root-layer label[for="itemx2-filter-removed"]{border-bottom-color:#d4af6e;color:#f2ead9;font-weight:700}
@keyframes itemx2-root-in{from{opacity:0;translate:0 7px;scale:.982}to{opacity:1;translate:0;scale:1}}@keyframes itemx2-root-out{from{opacity:1}to{opacity:0;translate:0 5px;scale:.988}}@keyframes itemx2-aux-spin{to{transform:rotate(360deg)}}
@media(max-width:520px){.itemx2-root-drawer .itemx2-root-panel{width:calc(100vw - 68px);height:min(660px,72dvh)}.itemx2-root-pos-lb,.itemx2-root-pos-lm,.itemx2-root-pos-lt{left:56px;right:auto;top:auto;bottom:8px;transform:none}.itemx2-root-pos-rb,.itemx2-root-pos-rm,.itemx2-root-pos-rt{right:56px;left:auto;top:auto;bottom:8px;transform:none}}
@media(prefers-reduced-motion:reduce){.itemx2-root-layer,.itemx2-root-panel,.itemx2-aux-status i{animation:none!important;transition:none!important}}
${codexPageStyle()}
`;
  function prefixRisuClasses(css) {
    return String(css || '').replace(/\.([a-zA-Z][\w-]*)/g, (_, name) =>
      name.startsWith('x-risu-') ? `.${name}` : `.x-risu-${name}`
    );
  }
  const bodyScrollStyle = `.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-fx,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-cond,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-event::before,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-event::after,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-main::before,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-icon::before,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-warning{visibility:hidden!important}.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-event{box-shadow:none!important}.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-fx,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-fx *,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-cond,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-cond *,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-event::before,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-event::after,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-main::before,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-icon::before,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-warning{animation-play-state:paused!important;filter:none!important;mix-blend-mode:normal!important;box-shadow:none!important}`;
  const bodyEffectsStyle = `body.x-risu-itemx2-effects-off .x-risu-itemx-fx,body.x-risu-itemx2-effects-off .x-risu-itemx-cond,body.x-risu-itemx2-effects-off .x-risu-itemx-codex-hero::before,body.x-risu-itemx2-effects-off .x-risu-itemx-codex-hero::after,body.x-risu-itemx2-effects-off .x-risu-itemx2-codex-fx,body.x-risu-itemx2-effects-off .x-risu-itemx2-inline-event::after,body.x-risu-itemx2-effects-off .x-risu-itemx2-inline-icon::before,body.x-risu-itemx2-effects-off .x-risu-itemx2-inline-warning{display:none!important;animation:none!important}`;
  const mainStyleText = () =>
    `${ITEMX_MAIN_STYLE}\n${prefixRisuClasses(`${ITEMX_CHAT_STYLE}\n${ITEMX_CODEX_INLINE_STYLE}\n${ITEMX_CODEX_INLINE_DENSE_STYLE}\n${ITEMX_CODEX_INLINE_APPRAISAL_STYLE}\n${rootDrawerStyle()}`)}\n${bodyScrollStyle}\n${bodyEffectsStyle}\n${badgeStyle()}`;

  function enqueue(key, work) {
    const prev = queues.get(key) || Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(work)
      .finally(() => {
        if (queues.get(key) === next) queues.delete(key);
      });
    queues.set(key, next);
    return next;
  }

  function refreshLatest(chat, lookup = buildMessageEventLookup(chat)) {
    loadMessageEventLedger(chat, lookup);
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    let latest = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      const text = messageData(messages[i]);
      if (messageEvents(text, 'item', lookup).length || messageEvents(text, 'codex', lookup).length) {
        latest = text;
        break;
      }
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
      // Manual events are authoritative source facts. Never truncate them by
      // count: doing so can discard an old exam while retaining later patches.
      return Array.isArray(rows)
        ? rows.filter((row) => row && Number.isInteger(row.afterIndex) && row.event?.kind)
        : [];
    } catch {
      return [];
    }
  }

  function messageEventLedger(chat) {
    try {
      const raw = chat?.scriptstate?.[ITEMX_MESSAGE_EVENT_KEY];
      const rows = typeof raw === 'string' ? JSON.parse(raw) : raw;
      // Every compact ref in a surviving message needs its event payload for
      // deterministic replay, including edits or rerolls of old messages.
      return Array.isArray(rows)
        ? rows.filter(
            (row) =>
              row &&
              /^[A-Za-z0-9_-]{1,80}$/.test(row.ref || '') &&
              ['item', 'codex'].includes(row.domain) &&
              row.payload?.event
          )
        : [];
    } catch {
      return [];
    }
  }

  function replayCheckpoint(chat) {
    try {
      const raw = chat?.scriptstate?.[ITEMX_CHECKPOINT_KEY];
      if (typeof raw === 'string' && raw === runtime.checkpointCacheRaw) return runtime.checkpointCache;
      const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (
        value?.v !== 1 ||
        !Number.isInteger(value.boundary) ||
        !value.item?.registry ||
        !value.codex?.skills ||
        !Array.isArray(value.rows) ||
        !Array.isArray(value.manual)
      )
        return null;
      if (typeof raw === 'string') {
        runtime.checkpointCacheRaw = raw;
        runtime.checkpointCache = value;
      }
      return value;
    } catch {
      return null;
    }
  }

  function prefixMarkerFingerprint(chat, boundary) {
    let source = `b:${boundary}`;
    for (let index = 0; index <= boundary; index += 1) {
      const markers = messageData(chat?.message?.[index]).match(
        /<!--(?:ITEMX2|CODEX2)(?::[A-Za-z0-9_-]+|@[A-Za-z0-9_-]{1,80}(?::[A-Za-z0-9_-]+)?)-->/g
      );
      if (markers) source += `|${index}:${markers.join('')}`;
    }
    return ITEMXCore.fnv1a(source);
  }

  function checkpointStatus(chat) {
    const checkpoint = replayCheckpoint(chat);
    const valid = Boolean(
      checkpoint &&
      checkpoint.boundary < (chat?.message || []).length &&
      checkpoint.prefix === prefixMarkerFingerprint(chat, checkpoint.boundary)
    );
    return { checkpoint, valid };
  }

  function buildMessageEventLookup(chat) {
    const archived = replayCheckpoint(chat)?.rows || [];
    const rows = [...archived, ...messageEventLedger(chat)],
      itemByRef = new Map(),
      codexByRef = new Map(),
      payloads = new Map();
    for (const row of rows) {
      if (row.domain === 'item') itemByRef.set(row.ref, row.payload);
      else if (row.domain === 'codex') codexByRef.set(row.ref, row.payload);
      payloads.set(`${row.domain}:${row.ref}`, row.payload);
    }
    return { rows, itemByRef, codexByRef, payloads };
  }

  function replaySourceFingerprint(chat) {
    const state = chat?.scriptstate || {};
    const stable = (value) => (typeof value === 'string' ? value : JSON.stringify(value ?? null));
    const status = checkpointStatus(chat),
      start = status.valid ? status.checkpoint.boundary + 1 : 0;
    let source = `${status.valid ? `${status.checkpoint.boundary}:${status.checkpoint.prefix}` : stable(state[ITEMX_CHECKPOINT_KEY])}|${stable(state[ITEMX_MANUAL_KEY])}|${stable(state[ITEMX_MESSAGE_EVENT_KEY])}`;
    const markerRe = /<!--(?:ITEMX2|CODEX2)(?::[A-Za-z0-9_-]+|@[A-Za-z0-9_-]{1,80}(?::[A-Za-z0-9_-]+)?)-->/g;
    for (let index = start; index < (chat?.message || []).length; index += 1) {
      const markers = messageData(chat.message[index]).match(markerRe);
      if (markers) source += `|${index}:${markers.join('')}`;
    }
    return ITEMXCore.fnv1a(source);
  }

  function loadMessageEventLedger(chat, lookup = buildMessageEventLookup(chat)) {
    runtime.eventPayloads = new Map(lookup.payloads);
    runtime.presentationRecords = null;
  }

  function embeddedViewCode(payload, domain) {
    const view = payload?.view;
    if (!view) return '';
    const codexEvent = payload?.event || {};
    const codexView =
      codexEvent.domain === 'skill'
        ? {
            i: view.id,
            n: view.name,
            g: view.glyph,
            r: view.rank,
            h: view.school,
            t: view.type,
            s: view.status,
            l: view.level,
            m: view.mastery,
            c: view.cost,
            o: view.cooldown,
            a: view.affinity,
            x: view.target,
            w: view.growth,
            z: view.description,
            f: (view.effects || []).slice(0, 2),
            j: view._inferred
          }
        : {
            i: view.id,
            n: view.name,
            g: view.glyph,
            k: view.kind,
            t: view.threat,
            r: view.relation,
            s: view.status,
            a: view.active,
            o: view.outcome,
            c: view.encounterCount,
            f: (view.moves || []).slice(0, 3)
          };
    const previous = payload?.previous
      ? { m: payload.previous.mastery, s: payload.previous.status, v: ITEMXCore.comparisonView(payload.previous) }
      : undefined;
    const envelope =
      domain === 'codex'
        ? {
            v: ITEMXCodex.VERSION,
            d: codexEvent.domain || '',
            k: codexEvent.kind,
            a: codexEvent.patch?.action,
            o: codexEvent.patch?.op,
            q: Object.keys(codexEvent.patch?.fields || {}),
            e: codexView,
            r: payload.review,
            p: previous
          }
        : {
            v: ITEMXCore.VERSION,
            p: ITEMXCore.comparisonView(payload.previous),
            r: payload.review,
            i: {
              i: view.id,
              n: view.name,
              t: view.itemType,
              e: view.emoji,
              r: view.rarity,
              d: view.displayRarity,
              p: view.power,
              q: view.required,
              u: view.durability,
              c: view.cost,
              o: view.possession,
              l: view.location,
              k: view.count,
              s: view.slot,
              h: view.theme,
              a: view.affinity,
              b: view.affinity2,
              x: view.condition,
              f: (view.effects || []).map((row) => [row.name, row.desc]),
              g: (view.augments || []).map((row) => [row.name, row.desc]),
              z: view.trivia
            }
          };
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
    if (payload?.view)
      return domain === 'codex'
        ? { v: payload.v, event: { domain: payload.domain || '' }, view: payload.view }
        : { v: payload.v, view: payload.view };
    if (domain === 'codex' && payload?.e) {
      const item = payload.e,
        skill = payload.d === 'skill';
      const view = skill
        ? {
            id: item.i,
            name: item.n,
            glyph: item.g,
            rank: item.r,
            school: item.h,
            type: item.t,
            status: item.s,
            level: item.l,
            mastery: item.m,
            cost: item.c,
            cooldown: item.o,
            affinity: item.a,
            target: item.x,
            growth: item.w,
            description: item.z,
            effects: item.f || [],
            _inferred: item.j
          }
        : {
            id: item.i,
            name: item.n,
            glyph: item.g,
            kind: item.k,
            threat: item.t,
            relation: item.r,
            status: item.s,
            active: item.a,
            outcome: item.o,
            encounterCount: item.c,
            moves: item.f || []
          };
      const event = { domain: payload.d || '', kind: payload.k || 'exam' };
      if (event.kind === 'patch')
        event.patch = {
          id: item.i,
          action: payload.a || null,
          op: payload.o || null,
          fields: Object.fromEntries((payload.q || []).map((key) => [key, true]))
        };
      return {
        v: payload.v,
        event,
        view,
        review: payload.r,
        previous: payload.p?.v || (payload.p ? { mastery: payload.p.m, status: payload.p.s } : null)
      };
    }
    if (domain !== 'item' || !payload?.i) return null;
    const item = payload.i;
    return {
      v: payload.v,
      previous: payload.p,
      review: payload.r,
      view: {
        id: item.i,
        name: item.n,
        itemType: item.t,
        emoji: item.e,
        rarity: item.r,
        displayRarity: item.d,
        power: item.p,
        required: item.q,
        durability: item.u,
        cost: item.c,
        possession: item.o,
        location: item.l,
        count: item.k,
        slot: item.s,
        theme: item.h,
        affinity: item.a,
        affinity2: item.b,
        condition: item.x,
        effects: (item.f || []).map((row) => ({ name: row[0], desc: row[1] })),
        augments: (item.g || []).map((row) => ({ name: row[0], desc: row[1] })),
        trivia: item.z
      }
    };
  }

  function itemMarkerPayload(marker) {
    const full = String(marker || '').match(/^<!--ITEMX2:([A-Za-z0-9_-]+)-->$/);
    if (full) return ITEMXCore.decodePayload(full[1]);
    const ref = String(marker || '').match(/^<!--ITEMX2@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?-->$/);
    if (!ref) return null;
    return runtime.eventPayloads.get(`item:${ref[1]}`) || inlineViewPayload(ref[2], 'item') || null;
  }

  function itemPayloadId(payload) {
    return payload?.view?.id || payload?.event?.item?.id || payload?.event?.patch?.id || '';
  }

  function coalesceAdjacentItemMarkers(content) {
    const source = String(content || '');
    const re = /<!--ITEMX2:[A-Za-z0-9_-]+-->|<!--ITEMX2@[A-Za-z0-9_-]{1,80}(?::[A-Za-z0-9_-]+)?-->/g;
    const rows = [];
    let match;
    while ((match = re.exec(source)))
      rows.push({ start: match.index, end: re.lastIndex, raw: match[0], payload: itemMarkerPayload(match[0]) });
    if (rows.length < 2) return source;
    const hidden = new Set();
    for (let index = 0; index < rows.length - 1; index += 1) {
      const current = rows[index],
        next = rows[index + 1];
      const id = itemPayloadId(current.payload),
        nextId = itemPayloadId(next.payload);
      if (id && id === nextId && next.payload?.view && !source.slice(current.end, next.start).trim()) hidden.add(index);
    }
    if (!hidden.size) return source;
    let output = '',
      cursor = 0;
    rows.forEach((row, index) => {
      output += source.slice(cursor, row.start);
      if (!hidden.has(index)) output += row.raw;
      cursor = row.end;
    });
    return output + source.slice(cursor);
  }

  function bareRefMarker(prefix, ref) {
    return `<!--${prefix}@${ref}-->`;
  }

  function reconcileStoredRefViews(chat, preferredLatestIndex = null) {
    const rows = messageEventLedger(chat);
    if (!rows.length) return { chat, changed: false };
    const byKey = new Map(rows.map((row) => [`${row.domain}:${row.ref}`, row.payload]));
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    let latestIndex = Number.isInteger(preferredLatestIndex) ? preferredLatestIndex : -1;
    if (latestIndex < 0 || latestIndex >= messages.length) {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const source = messageData(messages[index]);
        if (source.match(ITEMX_REF_RE) || source.match(ITEMX_CODEX_REF_RE)) {
          latestIndex = index;
          break;
        }
      }
    }
    let next = null,
      changed = false;
    for (let index = 0; index < messages.length; index += 1) {
      const original = messageData(messages[index]);
      const keepInline = index === latestIndex;
      let source = original.replace(ITEMX_REF_RE, (raw, ref, inline) =>
        keepInline
          ? inline
            ? raw
            : compactRefMarker('ITEMX2', ref, byKey.get(`item:${ref}`), 'item')
          : bareRefMarker('ITEMX2', ref)
      );
      source = source.replace(ITEMX_CODEX_REF_RE, (raw, ref, inline) =>
        keepInline
          ? inline
            ? raw
            : compactRefMarker('CODEX2', ref, byKey.get(`codex:${ref}`), 'codex')
          : bareRefMarker('CODEX2', ref)
      );
      if (source === original) continue;
      if (!next) next = ITEMXCore.clone(chat);
      const message = next.message[index];
      if (typeof message.data === 'string') message.data = source;
      else if (typeof message.content === 'string') message.content = source;
      changed = true;
    }
    return { chat: next || chat, changed };
  }

  function messageEvents(text, domain, lookup) {
    const byRef = domain === 'item' ? lookup.itemByRef : lookup.codexByRef;
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

  function rebuildCodexWithLedger(chat, lookup = buildMessageEventLookup(chat), options = {}) {
    const state = options.base ? ITEMXCodex.clone(options.base) : ITEMXCodex.snapshot();
    const messages = chat?.message || [],
      start = Math.max(0, options.start || 0),
      end = Math.min(messages.length - 1, options.end ?? messages.length - 1);
    let transport = options.transport || '';
    for (let index = start; index <= end; index += 1) {
      const narrative = messageData(messages[index]);
      for (const event of messageEvents(narrative, 'codex', lookup)) {
        // Events are reconciled exactly once when committed. Replay is a pure
        // fold over stored facts, never a second interpretation of prose.
        ITEMXCodex.applyEvent(state, event);
        transport += JSON.stringify(event);
      }
    }
    state.fingerprint = ITEMXCore.fnv1a(transport);
    state.updatedAt = Date.now();
    return state;
  }

  function compactMessageTransports(chat, index) {
    const next = ITEMXCore.clone(chat),
      message = next.message?.[index];
    if (!message) return { chat: next, changed: false };
    let source = messageData(message),
      ordinal = 0,
      changed = false;
    const rows = messageEventLedger(next),
      byKey = new Map(rows.map((row) => [`${row.domain}:${row.ref}`, row]));
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
      text.replace(ITEMX_REF_RE, (_, ref) => {
        used.add(`item:${ref}`);
        return '';
      });
      text.replace(ITEMX_CODEX_REF_RE, (_, ref) => {
        used.add(`codex:${ref}`);
        return '';
      });
    }
    // Remove only orphaned rows. Count/byte truncation corrupts replay by
    // leaving refs in messages whose authoritative events no longer exist.
    const kept = [...byKey.entries()].filter(([key]) => used.has(key)).map(([, row]) => row);
    next.scriptstate = { ...(next.scriptstate || {}), [ITEMX_MESSAGE_EVENT_KEY]: JSON.stringify(kept) };
    const reconciled = reconcileStoredRefViews(next, index).chat;
    return { chat: checkpointReplay(reconciled), changed: true };
  }

  function checkpointReplay(chat) {
    const messages = Array.isArray(chat?.message) ? chat.message : [],
      status = checkpointStatus(chat);
    const liveRows = messageEventLedger(chat),
      liveManual = manualLedger(chat);
    const tailMessages = messages.length - (status.valid ? status.checkpoint.boundary + 1 : 0);
    const eventPressure = liveRows.length + liveManual.length >= ITEMX_CHECKPOINT_TAIL_EVENTS;
    const messagePressure = tailMessages >= ITEMX_CHECKPOINT_TRIGGER_MESSAGES;
    if (!eventPressure && !messagePressure && !(status.checkpoint && !status.valid)) return chat;
    const boundary = messagePressure ? messages.length - ITEMX_CHECKPOINT_TAIL_MESSAGES - 1 : messages.length - 1;
    if (boundary < 0 || (status.valid && boundary <= status.checkpoint.boundary)) return chat;
    const lookup = buildMessageEventLookup(chat);
    const allManual = [...(status.checkpoint?.manual || []), ...liveManual];
    const item = rebuildWithManual(chat, lookup, { end: boundary, manual: allManual });
    const codex = rebuildCodexWithLedger(chat, lookup, { end: boundary });
    const used = new Set();
    for (let index = 0; index <= boundary; index += 1) {
      const text = messageData(messages[index]);
      text.replace(ITEMX_REF_RE, (_, ref) => {
        used.add(`item:${ref}`);
        return '';
      });
      text.replace(ITEMX_CODEX_REF_RE, (_, ref) => {
        used.add(`codex:${ref}`);
        return '';
      });
    }
    const rowsByKey = new Map(lookup.rows.map((row) => [`${row.domain}:${row.ref}`, row]));
    const rows = [...rowsByKey].filter(([key]) => used.has(key)).map(([, row]) => row);
    const manual = allManual.filter((row) => row.afterIndex >= 0 && row.afterIndex <= boundary);
    const checkpoint = { v: 1, boundary, prefix: prefixMarkerFingerprint(chat, boundary), item, codex, rows, manual };
    const encoded = JSON.stringify(checkpoint);
    if (encoded.length > 1572864) return chat;
    const next = ITEMXCore.clone(chat);
    const tailRows = [...rowsByKey].filter(([key]) => !used.has(key)).map(([, row]) => row);
    const tailManual = allManual.filter((row) => !(row.afterIndex >= 0 && row.afterIndex <= boundary));
    next.scriptstate = {
      ...(next.scriptstate || {}),
      [ITEMX_CHECKPOINT_KEY]: encoded,
      [ITEMX_MESSAGE_EVENT_KEY]: JSON.stringify(tailRows),
      [ITEMX_MANUAL_KEY]: JSON.stringify(tailManual)
    };
    delete next.scriptstate[ITEMXCore.STATE_KEY];
    return next;
  }

  function rebuildWithManual(chat, lookup = buildMessageEventLookup(chat), options = {}) {
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    const start = Math.max(0, options.start || 0),
      end = Math.min(messages.length - 1, options.end ?? messages.length - 1);
    const ledger = options.manual || [
        ...(start === 0 ? replayCheckpoint(chat)?.manual || [] : []),
        ...manualLedger(chat)
      ],
      manualByIndex = new Map(),
      manualTail = [],
      reg = options.registry ? ITEMXCore.clone(options.registry) : ITEMXCore.newRegistry();
    for (const row of ledger) {
      if (row.afterIndex < 0 || row.afterIndex >= messages.length) {
        if (end === messages.length - 1) manualTail.push(row);
      } else if (row.afterIndex < start || row.afterIndex > end) continue;
      else {
        const rows = manualByIndex.get(row.afterIndex) || [];
        rows.push(row);
        manualByIndex.set(row.afterIndex, rows);
      }
    }
    let transport = options.transport || '';
    const apply = (event) => {
      ITEMXCore.applyEvent(reg, event);
      transport += ITEMXCore.marker({ v: ITEMXCore.VERSION, event });
    };
    for (let index = start; index <= end; index += 1) {
      for (const event of messageEvents(messageData(messages[index]), 'item', lookup)) apply(event);
      for (const row of manualByIndex.get(index) || []) apply(row.event);
    }
    for (const row of manualTail) apply(row.event);
    return {
      schema: ITEMXCore.VERSION,
      rev: 2,
      fingerprint: ITEMXCore.fnv1a(transport),
      updatedAt: Date.now(),
      registry: reg
    };
  }

  async function rebuildCurrent({ upgradeDisplayRefs = false } = {}) {
    const ctx = await context();
    if (!ctx) return null;
    return enqueue(ctx.key, async () => {
      let latestChat = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
      if (!latestChat) return null;
      if (
        upgradeDisplayRefs &&
        !latestChat.isStreaming &&
        !(latestChat.message || []).some((message) => message?.isStreaming)
      ) {
        const reconciled = reconcileStoredRefViews(latestChat);
        if (reconciled.changed && runtime.activeContextKey === ctx.key) {
          await Risuai.setChatToIndex(ctx.characterIndex, ctx.chatIndex, reconciled.chat);
          latestChat = reconciled.chat;
          debugRecord('display refs', 'kept one self-contained view and compacted older refs');
        }
      }
      const lookup = buildMessageEventLookup(latestChat);
      const checkpoint = checkpointStatus(latestChat);
      const manual = checkpoint.valid
        ? manualLedger(latestChat)
        : [...(checkpoint.checkpoint?.manual || []), ...manualLedger(latestChat)];
      const replay = checkpoint.valid
        ? {
            start: checkpoint.checkpoint.boundary + 1,
            registry: checkpoint.checkpoint.item.registry,
            base: checkpoint.checkpoint.codex
          }
        : {};
      const snapshot = rebuildWithManual(latestChat, lookup, { ...replay, manual });
      const codexBase = rebuildCodexWithLedger(latestChat, lookup, replay);
      const lorebookSourceFingerprint = encounterRegistryFingerprint(codexBase);
      const codexSnapshot = ITEMXLorebook.apply(codexBase, ITEMXLorebook.read(latestChat));
      const settings = await outputSettings(ctx.character);
      refreshLatest(latestChat, lookup);
      // Normal rebuilds are deliberately read-only. Writing an entire chat
      // snapshot here can race another module's output hook and restore an
      // older assistant message over its freshly appended display markers.
      runtime.status = `정상 · 아이템 ${snapshot.registry.order.length} · 스킬 ${codexSnapshot.skills.order.length} · 도감 ${codexSnapshot.monsters.order.length}`;
      const loaded = {
        ...ctx,
        chat: latestChat,
        snapshot,
        codexSnapshot,
        lorebookSourceFingerprint,
        replayFingerprint: replaySourceFingerprint(latestChat),
        ...settings
      };
      runtime.cachedLoaded = loaded;
      runtime.cachedGeneration = runtime.generation;
      return loaded;
    });
  }

  const CHAT_DATA_KEYS = [
    ITEMXCore.STATE_KEY,
    ITEMXCore.CHAT_KEY,
    ITEMXCodex.STATE_KEY,
    ITEMX_MANUAL_KEY,
    ITEMX_MESSAGE_EVENT_KEY,
    ITEMX_CHECKPOINT_KEY,
    ITEMX_AUX_KEY,
    ITEMX_LORE_KEY
  ];

  function cleanChatPluginData(chat) {
    const next = ITEMXCore.clone(chat),
      messages = Array.isArray(next?.message) ? next.message : [];
    let cleanedMessages = 0,
      removedMarkers = 0,
      removedStateKeys = 0;
    for (const message of messages) {
      const original = messageData(message);
      const markers =
        original.match(/<!--(?:ITEMX2|CODEX2)(?::[A-Za-z0-9_-]+|@[A-Za-z0-9_-]{1,80}(?::[A-Za-z0-9_-]+)?)-->/g) || [];
      let source = stripAllTransport(original)
        .replace(ITEMX_REF_RE, '')
        .replace(ITEMX_CODEX_REF_RE, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n');
      removedMarkers += markers.length;
      if (source === original) continue;
      if (typeof message.data === 'string') message.data = source;
      else if (typeof message.content === 'string') message.content = source;
      cleanedMessages += 1;
    }
    next.scriptstate = { ...(next.scriptstate || {}) };
    for (const key of CHAT_DATA_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(next.scriptstate, key)) continue;
      delete next.scriptstate[key];
      removedStateKeys += 1;
    }
    return { chat: next, cleanedMessages, removedMarkers, removedStateKeys };
  }

  async function cleanCurrentChatItemx() {
    const ctx = await context();
    if (!ctx) throw new Error('현재 채팅을 찾을 수 없습니다.');
    const result = await enqueue(ctx.key, async () => {
      const active = await context();
      if (!active || active.key !== ctx.key) throw new Error('정리 중 채팅이 바뀌었습니다. 다시 시도하세요.');
      const latest = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
      if (!latest) throw new Error('현재 채팅을 불러오지 못했습니다.');
      if (latest.isStreaming || (latest.message || []).some((message) => message?.isStreaming || message?.bgContinue)) {
        throw new Error('출력 스트리밍이 끝난 뒤 정리할 수 있습니다.');
      }
      const cleaned = cleanChatPluginData(latest);
      await Risuai.setChatToIndex(ctx.characterIndex, ctx.chatIndex, cleaned.chat);
      // Cleanup is intended for leaving ITEMX behind. Disable this bot only
      // after the chat write succeeds so catch-up cannot immediately recreate
      // the markers that were just removed.
      await setEnabled(ctx.character, false);
      return cleaned;
    });
    runtime.cleanupArmedUntil = 0;
    runtime.latestMarkers.clear();
    runtime.latestOutput = '';
    runtime.pendingMarkers.clear();
    runtime.pendingMarkersAt = 0;
    runtime.eventPayloads = new Map();
    runtime.markerHtmlCache.clear();
    runtime.detailHtmlCache.clear();
    runtime.catchUpFingerprint = '';
    runtime.catchUpFailedFingerprint = '';
    runtime.catchUpFailures = 0;
    runtime.catchUpRetryAt = 0;
    runtime.auxCandidateFingerprint = '';
    runtime.auxCandidateSince = 0;
    runtime.auxCandidateChecks = 0;
    runtime.cachedLoaded = null;
    runtime.cachedGeneration = -1;
    runtime.generation += 1;
    runtime.status = `현재 채팅 정리 완료 · 마커 ${result.removedMarkers}개`;
    const loaded = await rebuildCurrent();
    if (loaded) loaded.enabled = false;
    return { ...result, loaded };
  }

  async function cachedOrRebuildCurrent() {
    const active = await context();
    if (!active) return null;
    const cached = runtime.cachedLoaded;
    if (
      cached?.key === active.key &&
      runtime.cachedGeneration === runtime.generation &&
      cached.replayFingerprint === replaySourceFingerprint(active.chat)
    )
      return cached;
    return rebuildCurrent();
  }

  async function cachedRequestState() {
    const active = await context();
    if (!active) return null;
    const cached = runtime.cachedLoaded;
    if (
      cached?.key === active.key &&
      runtime.cachedGeneration === runtime.generation &&
      cached.replayFingerprint === replaySourceFingerprint(active.chat)
    )
      return cached;
    return rebuildCurrent();
  }

  async function commitManualEvents(loaded, events, label, review = { source: 'manual' }, refresh = true) {
    if (!loaded || !Array.isArray(events) || !events.length) throw new Error('No manual events to commit');
    const latest = await Risuai.getChatFromIndex(loaded.characterIndex, loaded.chatIndex);
    if (!latest) throw new Error('Chat disappeared during manual operation');
    if (loaded.expectedChat && JSON.stringify(latest) !== JSON.stringify(loaded.expectedChat))
      throw new Error('저장 직전 대화가 변경되어 보완을 취소했습니다.');
    const ledger = manualLedger(latest);
    const afterIndex = Math.max(-1, (latest.message || []).length - 1);
    const scratch = rebuildWithManual(latest).registry;
    for (const event of events) {
      const previous = ITEMXCore.comparisonView(scratch.items[event.item?.id || event.patch?.id]);
      const view = ITEMXCore.clone(ITEMXCore.applyEvent(scratch, event));
      if (!view) throw new Error('수동 변경을 적용할 수 없습니다.');
      ledger.push({
        at: Date.now(),
        afterIndex,
        label,
        event: ITEMXCore.clone(event),
        presentation: { previous, view: ITEMXCore.comparisonView(view), review }
      });
    }
    let next = ITEMXCore.clone(latest);
    next.scriptstate = { ...(next.scriptstate || {}), [ITEMX_MANUAL_KEY]: JSON.stringify(ledger) };
    next = checkpointReplay(next);
    const snapshot = rebuildWithManual(
      next,
      buildMessageEventLookup(next),
      checkpointStatus(next).valid
        ? {
            start: replayCheckpoint(next).boundary + 1,
            registry: replayCheckpoint(next).item.registry,
            manual: manualLedger(next)
          }
        : {}
    );
    await Risuai.setChatToIndex(loaded.characterIndex, loaded.chatIndex, ITEMXCore.writeSnapshot(next, snapshot));
    runtime.status = `${label} · ${events.length}건`;
    return refresh ? rebuildCurrent() : null;
  }

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
      '보조 모델 제공자를 사용할 수 없습니다. Risu 설정에서 보조 모델을 변경하거나 해당 제공자 플러그인을 켜세요.'
    );
    error.code = 'AUX_PROVIDER_UNAVAILABLE';
    return error;
  }

  function auxStatusText() {
    if (runtime.auxActive > 0) return runtime.auxLabel || '보조 모델 처리 중';
    const last = runtime.auxLast;
    if (!last?.at) return '아직 실행 기록 없음';
    const time = new Date(last.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${last.label} · ${time}`;
  }

  function connectionSummary() {
    const hook =
      runtime.permissions.replacer === true
        ? ['모델 훅 연결', 'on']
        : runtime.permissions.replacer === false
          ? ['모델 훅 오류', 'off']
          : ['모델 훅 확인 전', 'warn'];
    const dom =
      runtime.permissions.mainDom === true
        ? ['화면 연결', 'on']
        : runtime.permissions.mainDom === false
          ? ['화면 권한 필요', 'off']
          : ['화면 확인 전', 'warn'];
    const listener =
      runtime.hooks.listener === 'unsupported'
        ? ['Pocket 호환', 'warn']
        : runtime.hooks.listener
          ? ['커밋 감지', 'on']
          : ['커밋 감지 전', 'warn'];
    return {
      hook,
      dom,
      listener,
      ready: runtime.permissions.replacer === true && runtime.permissions.mainDom === true
    };
  }

  async function updateConnectionUi() {
    if (!runtime.mainDoc) return;
    const connection = connectionSummary();
    const chips = [
      ['hook', connection.hook],
      ['dom', connection.dom],
      ['listener', connection.listener]
    ];
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
    try {
      await change();
    } finally {
      runtime.settingChangeBusy = false;
    }
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
      if (runtime.auxLast.state === 'done' && runtime.auxActive === 0)
        await indicator.addClass('x-risu-itemx2-aux-status-done');
      else await indicator.removeClass('x-risu-itemx2-aux-status-done');
      if (runtime.auxLast.state === 'failed' && runtime.auxActive === 0)
        await indicator.addClass('x-risu-itemx2-aux-status-failed');
      else await indicator.removeClass('x-risu-itemx2-aux-status-failed');
    } catch (error) {
      fail('aux indicator', error);
    }
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
        Risuai.runLLMModel({ messages: [{ role: 'user', content: prompt }], mode: 'otherAx', allowPlugins: true }),
        90000,
        '보조 모델이 90초 안에 응답하지 않았습니다.'
      );
      const providerError = auxiliaryProviderError(result);
      if (providerError) throw providerError;
      runtime.auxProviderUnavailable = false;
      runtime.auxProviderError = '';
      runtime.auxLast = { state: 'done', label: '보조 모델 응답 수신', at: Date.now(), events: null };
      return result;
    } catch (error) {
      const providerError = auxiliaryProviderError(error) || error;
      if (providerError?.code === 'AUX_PROVIDER_UNAVAILABLE') {
        runtime.auxProviderUnavailable = true;
        runtime.auxProviderError = providerError.message;
      }
      runtime.auxLast = { state: 'failed', label: '보조 모델 호출 실패', at: Date.now(), events: null };
      throw providerError;
    } finally {
      runtime.auxActive = Math.max(0, runtime.auxActive - 1);
      await syncAuxIndicator();
      if (runtime.auxActive === 0)
        await setAuxOutcome(runtime.auxLast.state, runtime.auxLast.label, runtime.auxLast.events);
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
    try {
      const raw = await Risuai.pluginStorage.getItem(`auxZero:${ctx.key}`);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  async function rememberAuxiliaryZero(ctx, guardKey) {
    const history = await auxiliaryZeroHistory(ctx);
    history[guardKey] = Date.now();
    await Risuai.pluginStorage.setItem(
      `auxZero:${ctx.key}`,
      JSON.stringify(Object.fromEntries(Object.entries(history).slice(-24)))
    );
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

  function auxiliarySemanticHash(value) {
    return ITEMXCore.fnv1a(auxiliaryVisibleText(value, { itemRefs: false }).replace(/\s+/g, ' ').trim());
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
    if (runtime.auxProviderUnavailable && !force) return [];
    const index = assistantMessageIndex(ctx.chat, messageIndex);
    if (index < 0) return null;
    const source = messageData(ctx.chat.message[index]);
    if (!force && !automaticAuxReady(ctx.chat, index, source)) return null;
    const sourceHash = ITEMXCore.fnv1a(source);
    const guardKey = `${index}:visible-${auxiliarySemanticHash(source)}:${settings.auxOutput}:${Number(settings.itemsEnabled)}${Number(settings.skillsEnabled)}${Number(settings.encountersEnabled)}:q${ITEMXQuality.REVISION}:p${ITEMX_AUX_PROMPT_REVISION}`;
    if (auxiliaryHistory(ctx.chat)[guardKey] && !force) return [];
    if ((await auxiliaryZeroHistory(ctx))[guardKey] && !force) return [];
    if (typeof Risuai.runLLMModel !== 'function') return null;

    return enqueue(`aux:${ctx.key}`, async () => {
      if (!force) await delay(350);
      const current = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
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
      runtime.status = '보조 출력 검토 중';
      const response = await runAuxModel(prompt, '보조 누락 복구 중');
      const raw = modelText(response);
      if (!raw) throw new Error('보조 출력이 비어 있습니다.');
      const parsed = settings.itemsEnabled
        ? ITEMXCore.extractResponse(raw, snapshot.registry)
        : { content: stripItemTransport(raw), events: [], errors: [] };
      const validationRegistry = ITEMXCore.clone(snapshot.registry);
      const validItems = [],
        partials = [],
        rejectedIds = [];
      const checkedIds = new Set();
      const itemSiblings = parsed.events.filter((event) => event.kind === 'exam').map((event) => event.item);
      const itemEvidenceContext = [conversation.triggeringUser, conversation.recent, committedNarrative]
        .filter(Boolean)
        .join('\n\n');
      for (const event of parsed.events) {
        if (event.kind !== 'exam') {
          if (ITEMXCore.applyEvent(validationRegistry, event) != null) validItems.push(event);
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
        if (ITEMXCore.applyEvent(validationRegistry, accepted) == null) continue;
        checkedIds.add(event.item.id);
        validItems.push(accepted);
        if (quality.status === 'partial') partials.push({ ...quality, event: accepted, sourceEvent: event });
      }
      let unresolvedPartials = partials;
      if (partials.length) {
        const partialMap = new Map(partials.map((one) => [one.event.item.id, one]));
        const repaired = new Map();
        try {
          const repairResponse = await runAuxModel(
            ITEMXQuality.repairPrompt(partials, committedNarrative),
            '아이템 상세정보 보완 중'
          );
          const repairRaw = modelText(repairResponse);
          const repairParsed = repairRaw ? ITEMXCore.extractResponse(repairRaw, validationRegistry) : { events: [] };
          for (const event of repairParsed.events) {
            const accepted = ITEMXQuality.acceptRepair(event, partialMap, validationRegistry);
            if (!accepted || ITEMXCore.applyEvent(validationRegistry, accepted) == null) continue;
            validItems.push(accepted);
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
      if (!valid.length && allErrors.length) throw new Error(`보조 출력 검증 실패 (${allErrors[0]})`);

      const latest = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
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
            [ITEMX_AUX_KEY]: JSON.stringify(Object.fromEntries(Object.entries(history).slice(-64)))
          };
          await Risuai.setChatToIndex(ctx.characterIndex, ctx.chatIndex, next);
          if (runtime.activeContextKey === ctx.key) {
            runtime.status = '보조 출력 · 근거 불충분';
            await setAuxOutcome('failed', '보조 검사 보류 · 수동 재검사 가능', 0);
          }
          return [];
        }
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
        [ITEMX_AUX_KEY]: JSON.stringify(Object.fromEntries(Object.entries(history).slice(-64)))
      };
      const compacted = compactMessageTransports(next, index).chat;
      const compactedLookup = buildMessageEventLookup(compacted);
      const rebuilt = rebuildWithManual(compacted, compactedLookup);
      const stillActive = runtime.activeContextKey === ctx.key;
      if (stillActive) {
        refreshLatest(compacted, compactedLookup);
        runtime.uiRemountAfter = Date.now() + 1200;
      }
      await Risuai.setChatToIndex(ctx.characterIndex, ctx.chatIndex, ITEMXCore.writeSnapshot(compacted, rebuilt));
      if (stillActive) {
        armEventBursts(markerText);
        commitEventBursts(compacted);
        runtime.cachedLoaded = null;
        runtime.generation += 1;
        runtime.uiRemountAfter = Date.now() + 1200;
        runtime.status = `보조 출력 · ${valid.length}건 복구`;
      }
      if (stillActive)
        await setAuxOutcome(
          unresolvedPartials.length || rejectedIds.length ? 'failed' : 'done',
          unresolvedPartials.length || rejectedIds.length
            ? `일부 보완 실패 · ${unresolvedPartials.length + rejectedIds.length}건 · 기존 정보 보존`
            : `보조 복구 완료 · ${valid.length}건`,
          valid.length
        );
      return valid;
    }).catch(async (error) => {
      fail('auxiliary recovery', error);
      if (runtime.activeContextKey === ctx.key) {
        runtime.status = '보조 출력 실패';
        await setAuxOutcome('failed', `보조 검사 실패 · ${String(error?.message || error).slice(0, 80)}`);
      }
      return error?.code === 'AUX_PROVIDER_UNAVAILABLE' ? [] : null;
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
    if (parsed.errors.length || parsed.events.length !== 1 || parsed.events[0].kind !== 'exam')
      throw new Error(`감정 결과 검증 실패 (${parsed.errors[0] || `events=${parsed.events.length}`})`);
    const event = parsed.events[0];
    if (task === 'create') {
      if (loaded.snapshot.registry.items[event.item.id])
        throw new Error('신규 생성이 기존 아이템 id를 덮으려 했습니다.');
      event.item.possession = 'owned';
      event.item.location = 'inventory';
      event.item.slot = null;
      event.item.count = Math.max(1, Number(event.item.count) || 1);
    } else {
      if (!target || event.item.id !== target.id) throw new Error('재감정 결과가 대상 id를 보존하지 않았습니다.');
      event.item.possession = target.possession;
      event.item.location = target.location;
      event.item.slot = target.slot || null;
      event.item.count = target.count;
    }
    return event;
  }

  async function repairOneItem(loaded, id) {
    if (!loaded?.itemsEnabled) throw new Error('아이템 기능을 먼저 활성화하세요.');
    if (!loaded || runtime.itemRepairBusy || runtime.auxActive || runtime.auxRecoveryPromise)
      throw new Error('이미 보조 모델이 처리 중입니다.');
    const record = presentationRecord('item', id);
    const missing = record.review?.missing || [];
    if (!missing.length) throw new Error('이 아이템에 기록된 미해결 필드가 없습니다.');
    runtime.itemRepairBusy = true;
    return enqueue(loaded.key, async () => {
      const active = await context();
      if (!active || active.key !== loaded.key) throw new Error('채팅이 변경되었습니다.');
      const chat = active.chat;
      if (chat.isStreaming || (chat.message || []).some((one) => one.isStreaming || one.bgContinue))
        throw new Error('출력 완료 후 다시 시도하세요.');
      const sourceIndex = record.review?.evidenceIndex ?? record.messageIndex;
      const source = messageData(chat.message?.[sourceIndex]);
      const reg = rebuildWithManual(chat).registry,
        item = reg.items[id];
      if (!item || item.possession === 'removed') throw new Error('현재 아이템을 찾을 수 없습니다.');
      const conversation = auxiliaryConversationContext(chat, sourceIndex);
      const narrative = [
        conversation.triggeringUser,
        conversation.recent,
        auxiliaryVisibleText(source, { itemRefs: false })
      ].join('\n\n');
      const evidence = ITEMXQuality.detectItemEvidence(narrative, item, Object.values(reg.items));
      if (!evidence.segment) throw new Error('원문 근거를 찾지 못했습니다. 아이템은 변경하지 않았습니다.');
      const partial = { event: { kind: 'exam', item }, missing, evidence };
      const raw = modelText(
        await runAuxModel(ITEMXQuality.repairPrompt([partial], narrative), `${item.name} · 누락 정보 보완 중`)
      );
      const parsed = ITEMXCore.extractResponse(raw, reg);
      const partialMap = new Map([[id, partial]]);
      const events = parsed.events.map((event) => ITEMXQuality.acceptRepair(event, partialMap, reg)).filter(Boolean);
      if (events.length !== 1 || parsed.events.length !== 1 || parsed.errors.length)
        throw new Error('근거와 일치하는 단일 보완 결과가 없습니다. 기존 정보는 보존됩니다.');
      const latest = await context();
      if (!latest || latest.key !== loaded.key || JSON.stringify(latest.chat) !== JSON.stringify(chat))
        throw new Error('처리 중 대화가 변경되어 보완을 적용하지 않았습니다.');
      const remaining = missing.filter((key) => !Object.prototype.hasOwnProperty.call(events[0].patch.fields, key));
      // This transaction already owns the queue; commitManualEvents only writes.
      await commitManualEvents(
        { ...loaded, chat: latest.chat, expectedChat: latest.chat },
        events,
        '누락 정보 보완',
        { source: 'auxiliary', checked: true, missing: remaining, evidenceIndex: sourceIndex },
        false
      );
      if (runtime.activeContextKey === loaded.key)
        await setAuxOutcome(
          remaining.length ? 'failed' : 'done',
          remaining.length ? `일부 보완 완료 · 미해결 ${remaining.length}개 필드` : '누락 정보 보완 완료',
          events.length
        );
    })
      .then(() => rebuildCurrent())
      .catch(async (error) => {
        if (runtime.activeContextKey === loaded.key && !runtime.unloading)
          await setAuxOutcome('failed', '누락 정보 보완 실패 · 기존 정보 보존', 0);
        throw error;
      })
      .finally(() => {
        runtime.itemRepairBusy = false;
      });
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
    if (runtime.auxActive > 0 || runtime.auxRecoveryPromise) return;
    if (runtime.legacyCommitTimer) globalThis.clearTimeout(runtime.legacyCommitTimer);
    runtime.legacyCommitTimer = globalThis.setTimeout(async () => {
      runtime.legacyCommitTimer = null;
      try {
        await catchUpLatestOutput({ syncUi: false });
        const loaded = await rebuildCurrent();
        if (loaded) commitEventBursts(loaded.chat);
        if (loaded?.encountersEnabled && loaded?.lorebookEncounterEnabled)
          await scanLorebookEncounters({ silent: true });
        await ensureRootInventory();
        if (!confirm && runtime.auxActive === 0 && !runtime.auxRecoveryPromise) scheduleLegacyCommitRecovery(true);
      } catch (error) {
        fail('legacy commit recovery', error);
      }
    }, 1800);
  }

  async function repairCommittedTransport(ctx, index, source) {
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
    const latest = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
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
    const stillActive = runtime.activeContextKey === ctx.key;
    if (stillActive) {
      refreshLatest(compacted, compactedLookup);
      runtime.rootFingerprint = '';
      runtime.cachedLoaded = null;
      runtime.generation += 1;
      runtime.uiRemountAfter = Date.now() + 1200;
    }
    await Risuai.setChatToIndex(ctx.characterIndex, ctx.chatIndex, ITEMXCore.writeSnapshot(compacted, snapshot));
    const errors = parsed.errors.length + codexParsed.errors.length,
      events = parsed.events.length + codexParsed.events.length;
    if (stillActive) runtime.status = errors ? `깨진 전송 격리 · ${errors}건` : `누락 훅 복구 · ${events}건`;
    return { ctx: { ...ctx, chat: compacted }, source: compactedSource };
  }

  async function catchUpLatestOutput({ syncUi = true } = {}) {
    if (!runtime.activeContextKey || runtime.auxActive > 0 || runtime.auxRecoveryPromise || runtime.bodyFxScrollActive)
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
      runtime.catchUpRetryAt = Date.now() + Math.min(120000, 5000 * 2 ** runtime.catchUpFailures);
    }
    if (syncUi) {
      const loaded = await rebuildCurrent();
      if (loaded) commitEventBursts(loaded.chat);
      if (loaded?.encountersEnabled && loaded?.lorebookEncounterEnabled) await scanLorebookEncounters({ silent: true });
      await ensureRootInventory();
    }
  }

  function scheduleCommittedOutputSync() {
    if (runtime.bodyFxScrollActive) {
      runtime.outputSyncDeferred = true;
      return runtime.outputSyncPromise;
    }
    if (runtime.outputSyncPromise) {
      runtime.outputSyncPending = true;
      return runtime.outputSyncPromise;
    }
    const pending = (async () => {
      do {
        runtime.outputSyncPending = false;
        await catchUpLatestOutput({ syncUi: false });
        const loaded = await rebuildCurrent();
        if (loaded) commitEventBursts(loaded.chat);
        if (loaded?.encountersEnabled && loaded?.lorebookEncounterEnabled) {
          await scanLorebookEncounters({ silent: true });
        }
        await ensureRootInventory();
      } while (runtime.outputSyncPending && !runtime.unloading);
    })()
      .catch((error) => fail('chat listener', error))
      .finally(() => {
        if (runtime.outputSyncPromise === pending) runtime.outputSyncPromise = null;
      });
    runtime.outputSyncPromise = pending;
    return pending;
  }

  function armCatchUpWatchdog() {
    if (runtime.unloading) return;
    if (runtime.catchUpTimer) globalThis.clearInterval(runtime.catchUpTimer);
    const interval = runtime.hooks.listener === true ? 45000 : 4500;
    runtime.catchUpTimer = globalThis.setInterval(() => {
      void catchUpLatestOutput().catch((error) => fail('latest output catch-up', error));
    }, interval);
  }

  const beforeRequest = async (messages, type) => {
    const safeMessages = (messages || []).map((message) => ({
      ...message,
      content: processTransportStripper(message.content)
    }));
    if (!mainRequestType(type)) return safeMessages;
    try {
      const loaded = await cachedRequestState();
      if (!loaded || !(await isEnabled(loaded.character))) return safeMessages;
      const settings = await outputSettings(loaded.character);
      runtime.debugEnabled = settings.debugEnabled;
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
      const instruction = `${protocolForSettings(settings, loaded.character, moduleAssets, { narrative: recent, entities: encounterEntities(loaded.codexSnapshot) })}${settings.itemsEnabled ? `\n\n${ITEMXCore.anchor(loaded.snapshot)}` : ''}${domains.length ? `\n\n${ITEMXCodex.anchor(loaded.codexSnapshot, recent, 9000, { enabledDomains: domains })}` : ''}`;
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
    try {
      const ctx = await context();
      if (!ctx) return content;
      const enabled = await isEnabled(ctx.character);
      const settings = await outputSettings(ctx.character);
      runtime.debugEnabled = settings.debugEnabled;
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
      const positioned = positionMarkersByNarrative(reviewed);
      armEventBursts(positioned);
      if (
        result.events.length ||
        result.errors.length ||
        codexResult.events.length ||
        codexResult.errors.length ||
        codexResult.content !== content
      ) {
        runtime.latestOutput = positioned;
        runtime.latestMarkers = markerCodes(positioned);
        runtime.pendingMarkers = new Set(runtime.latestMarkers);
        runtime.pendingMarkersAt = Date.now();
        const errors = result.errors.length + codexResult.errors.length,
          events = result.events.length + codexResult.events.length;
        runtime.status = errors ? `격리 ${errors}건` : `메인 출력 ${events}건 처리`;
        runtime.generation += 1;
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
    if (runtime.hooks.listener === 'unsupported' && runtime.auxActive === 0 && !runtime.auxRecoveryPromise)
      scheduleLegacyCommitRecovery();
    return processed;
  };

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

  const codexInlineStat = (label, value) =>
    `<i><b>${ITEMXCore.esc(label)}</b><span>${ITEMXCore.esc(value || '미상')}</span></i>`;

  function codexInlineEventHtml(payload, motion = 'full') {
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
        learn: ['SKILL LEARNED', '습득'],
        equip: ['SKILL EQUIPPED', '장착'],
        unequip: ['SKILL UPDATED', '장착 해제'],
        mastery: ['SKILL MASTERY UPDATED', '숙련 상승'],
        seal: ['SKILL SEALED', '봉인'],
        unseal: ['SKILL UNSEALED', '봉인 해제'],
        forget: ['SKILL LOST', '상실']
      };
      const [kicker, state] =
        event.kind === 'exam'
          ? ['NEW SKILL ARCHIVED', '최초 등록']
          : labels[action] ||
            (op === 'remove'
              ? ['SKILL LOST', '상실']
              : op === 'restore'
                ? ['SKILL RESTORED', '복원']
                : ['SKILL RECORD UPDATED', '큰 변화']);
      const mastery = entity.mastery != null && Number.isFinite(Number(entity.mastery)) ? Number(entity.mastery) : null;
      const priorMastery =
        previous.mastery != null && Number.isFinite(Number(previous.mastery)) ? Number(previous.mastery) : null;
      const masteryText =
        mastery != null && priorMastery != null && mastery !== priorMastery
          ? `${priorMastery}%→${mastery}%`
          : mastery != null
            ? `${mastery}%`
            : '미상';
      const quick = [
        ['LEVEL', entity.level == null ? '미상' : `Lv.${entity.level}`],
        ['숙련도', masteryText],
        ['소모', entity.cost || '미상'],
        ['재사용', entity.cooldown || '미상']
      ]
        .map(([label, value]) => codexInlineStat(label, value))
        .join('');
      const effect =
        (entity.effects || []).slice(0, 2).join(' · ') ||
        entity.description ||
        entity.growth ||
        '스킬 정보가 CODEX에 기록되었습니다.';
      const classes = `itemx2-inline-event itemx2-inline-appraisal itemx2-inline-skill itemx2-inline-skill-theme-${skillTheme(entity)} itemx2-inline-tier-${appraisal.tier} ${motion === 'off' ? 'motion-off' : motion === 'lite' ? 'motion-lite' : ''}`;
      const meta = [
        entity.school || '미분류',
        entity.type || 'active',
        entity.status || 'learned',
        entity.target ? `대상 ${entity.target}` : ''
      ]
        .filter(Boolean)
        .join(' · ');
      return `<section class="${classes}" style="${appraisal.style}"><div class="itemx2-inline-main"><span class="itemx2-inline-icon"><span>${ITEMXCore.esc(skillEmoji(entity))}</span></span><span class="itemx2-inline-copy"><small class="itemx2-inline-kicker">${kicker}</small><strong class="itemx2-inline-name">${ITEMXCore.esc(entity.name || entity.id)}</strong><span class="itemx2-inline-tier">${ITEMXCore.esc(entity.rank || '미분류')}</span><span class="itemx2-inline-meta">${ITEMXCore.esc(meta)}</span></span><i class="itemx2-inline-state">${state}</i></div><div class="itemx2-inline-rule"></div><span class="itemx2-inline-quick">${quick}</span><footer class="itemx2-inline-foot"><b>${action === 'mastery' ? '성장 기록' : '발현 효과'}</b><span>${ITEMXCore.esc(effect)}</span></footer>${ITEMXRenderer.changesHtml(payload.previous, entity, 'skill')}</section>`;
    }
    const appraisal = codexInlineAppraisalStyle(entity, 'monster');
    const labels = {
      encounter: ['ENCOUNTER RESUMED', '교전 개시'],
      end: ['ENCOUNTER RESOLVED', '종료'],
      escape: ['ENCOUNTER RESOLVED', '도주'],
      defeat: ['ENCOUNTER RESOLVED', '격파'],
      kill: ['ENCOUNTER RESOLVED', '사망'],
      ally: ['ENCOUNTER UPDATED', '아군화']
    };
    const [kicker, state] =
      event.kind === 'exam'
        ? ['ENCOUNTER REGISTERED', entity.status === 'active' ? '교전 중' : '최초 등록']
        : labels[action] ||
          (op === 'remove'
            ? ['ENCOUNTER LOST', '기록 소실']
            : op === 'restore'
              ? ['ENCOUNTER RESTORED', '복원']
              : ['ENCOUNTER UPDATED', '큰 변화']);
    const detail =
      entity.outcome || (entity.moves || []).slice(0, 3).join(' · ') || '조우 정보가 전투 도감에 기록되었습니다.';
    const warning =
      entity.active && ['hostile', 'sparring'].includes(String(entity.relation || ''))
        ? '<span class="itemx2-inline-warning" aria-hidden="true"></span>'
        : '';
    const quick = [
      ['분류', entity.kind || '미분류'],
      ['위협도', entity.threat || '미상'],
      ['관계', entity.relation || 'unknown'],
      ['상태', entity.status || 'unknown']
    ]
      .map(([label, value]) => codexInlineStat(label, value))
      .join('');
    const classes = `itemx2-inline-event itemx2-inline-appraisal itemx2-inline-encounter itemx2-inline-tier-${appraisal.tier} ${ended ? 'itemx2-inline-ended' : ''} ${motion === 'off' ? 'motion-off' : motion === 'lite' ? 'motion-lite' : ''}`;
    const aliases = Array.isArray(entity.aliases) ? entity.aliases.slice(0, 2).join(' · ') : '';
    return `<section class="${classes}" style="${appraisal.style}">${warning}<div class="itemx2-inline-main"><span class="itemx2-inline-icon"><span>${ITEMXCore.esc(encounterEmoji(entity))}</span></span><span class="itemx2-inline-copy"><small class="itemx2-inline-kicker">${kicker}</small><strong class="itemx2-inline-name">${ITEMXCore.esc(entity.name || entity.id)}</strong><span class="itemx2-inline-tier">${ITEMXCore.esc(entity.threat || '위협 미상')}</span><span class="itemx2-inline-meta">${ITEMXCore.esc(aliases || entity.description || '전투 도감 기록')}</span></span><i class="itemx2-inline-state">${state}</i></div><div class="itemx2-inline-rule"></div><span class="itemx2-inline-quick">${quick}</span><footer class="itemx2-inline-foot"><b>${ended ? '최근 전투 결과' : '관측 기록'}</b><span>${ITEMXCore.esc(detail)}</span></footer>${ITEMXRenderer.changesHtml(payload.previous, entity, 'monster')}</section>`;
  }

  function presentationPayloads(text) {
    const rows = [];
    String(text || '').replace(
      /<!--(ITEMX2|CODEX2)(?::([A-Za-z0-9_-]+)|@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?)-->/g,
      (raw, prefix, code, ref, inline, at) => {
        const domain = prefix === 'ITEMX2' ? 'item' : 'codex';
        const payload = code
          ? (domain === 'item' ? ITEMXCore : ITEMXCodex).decodePayload(code)
          : runtime.eventPayloads.get(`${domain}:${ref}`) || inlineViewPayload(inline, domain);
        if (payload?.view && !payload.error)
          rows.push({ payload, domain: domain === 'codex' ? payload.event?.domain : 'item', at });
        return raw;
      }
    );
    return rows;
  }

  function eventBurstKey(payload) {
    return `e${ITEMXCore.fnv1a(runtime.activeContextKey)}_${ITEMXCore.fnv1a(JSON.stringify([payload.event, payload.view]))}`;
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
    if (!runtime.visualEffectsEnabled || runtime.unloading) return;
    for (const [key, candidate] of runtime.eventBursts)
      if (candidate.expires < Date.now()) runtime.eventBursts.delete(key);
    for (const { payload, domain } of presentationPayloads(text)) {
      if (!ITEMXRenderer.eventKind(payload, domain)) continue;
      const key = eventBurstKey(payload);
      if (runtime.eventBurstSeen.has(key) || runtime.eventBursts.has(key)) continue;
      if (runtime.eventBursts.size >= 8) break;
      runtime.eventBursts.set(key, { expires: Date.now() + 30000, committed: false });
    }
  }
  function burstTimer(fn, ms) {
    const timer = globalThis.setTimeout(() => {
      runtime.eventBurstTimers.delete(timer);
      void fn();
    }, ms);
    runtime.eventBurstTimers.add(timer);
  }
  function commitEventBursts(chat) {
    if (!runtime.eventBursts.size || chat?.isStreaming) return;
    const message = chat?.message?.[assistantMessageIndex(chat)];
    if (!message || message.isStreaming || message.bgContinue) return;
    let activated = false;
    for (const { payload } of presentationPayloads(messageData(message))) {
      const candidate = runtime.eventBursts.get(eventBurstKey(payload));
      if (!candidate || candidate.committed || candidate.expires < Date.now()) continue;
      candidate.committed = true;
      candidate.expires = Date.now() + 3000;
      activated = true;
    }
    if (activated) for (const delayMs of [0, 350, 1000]) burstTimer(flushEventBursts, delayMs);
  }
  async function flushEventBursts() {
    if (
      runtime.unloading ||
      !runtime.mainDoc ||
      runtime.eventBurstBusy ||
      runtime.bodyFxScrollActive ||
      !runtime.eventBursts.size
    )
      return;
    runtime.eventBurstBusy = true;
    const key = runtime.activeContextKey;
    try {
      let played = 0;
      for (const [id, candidate] of runtime.eventBursts) {
        if (candidate.expires < Date.now() || !runtime.visualEffectsEnabled) {
          runtime.eventBursts.delete(id);
          continue;
        }
        if (!candidate.committed || played >= 2) continue;
        const element = await runtime.mainDoc.querySelector(`[x-itemx2-event="${id}"]`);
        if (runtime.unloading || key !== runtime.activeContextKey) return;
        if (!element) continue;
        // Consume before mutating DOM. Re-rendered markup never contains this class.
        runtime.eventBursts.delete(id);
        runtime.eventBurstSeen.add(id);
        while (runtime.eventBurstSeen.size > 256)
          runtime.eventBurstSeen.delete(runtime.eventBurstSeen.values().next().value);
        runtime.eventBurstOwners.add(element);
        await element.addClass('x-risu-itemx2-burst-active');
        if (runtime.unloading || key !== runtime.activeContextKey) {
          await element.removeClass('x-risu-itemx2-burst-active');
          runtime.eventBurstOwners.delete(element);
          return;
        }
        played++;
        burstTimer(async () => {
          try {
            await element.removeClass('x-risu-itemx2-burst-active');
          } catch {}
          runtime.eventBurstOwners.delete(element);
        }, 1350);
      }
    } catch (error) {
      debugRecord('event burst', error?.message || String(error));
    } finally {
      runtime.eventBurstBusy = false;
    }
  }
  function clearEventBursts() {
    for (const timer of runtime.eventBurstTimers) globalThis.clearTimeout(timer);
    runtime.eventBurstTimers.clear();
    runtime.eventBursts.clear();
    for (const element of runtime.eventBurstOwners)
      void element.removeClass('x-risu-itemx2-burst-active').catch(() => {});
    runtime.eventBurstOwners.clear();
  }

  const displayHandler = (content) => {
    const raw = String(content || '');
    if (!raw.includes('<!--ITEMX2') && !raw.includes('<!--CODEX2')) return content;
    const positioned =
      raw.includes('<!--ITEMX2:') || raw.includes('<!--CODEX2:') ? positionMarkersByNarrative(raw) : raw;
    const source = coalesceAdjacentItemMarkers(positioned);
    let found = false,
      hasFullCard = false,
      hasCodexCard = false;
    const renderPayload = (cacheKey, payload, motion) => {
      const key = `${cacheKey}:${motion}`;
      if (runtime.markerHtmlCache.has(key)) return runtime.markerHtmlCache.get(key);
      const html = decorateInlineEvent(
        ITEMXRenderer.renderMarkerPayload(payload, { inline: true, motion }),
        payload,
        'item'
      );
      runtime.markerHtmlCache.set(key, html);
      while (runtime.markerHtmlCache.size > 64)
        runtime.markerHtmlCache.delete(runtime.markerHtmlCache.keys().next().value);
      return html;
    };
    const markerMotion = (key) => {
      if (!runtime.visualEffectsEnabled) return 'off';
      if (!runtime.latestMarkers.size) return 'lite';
      return runtime.latestMarkers.has(key) ? 'lite' : 'off';
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
          codexInlineEventHtml(payload, markerMotion(`CODEX2:${code}`)),
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
        const payload = runtime.eventPayloads.get(`item:${ref}`) || inlineViewPayload(inline, 'item');
        if (!payload || payload.error) return `<span class="itemx-event-chip">📦 ITEMX CODEX · 기록 복원 중</span>`;
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
        if (!inline && !runtime.latestMarkers.has(`CODEX2@${ref}`)) return '';
        const payload = runtime.eventPayloads.get(`codex:${ref}`) || inlineViewPayload(inline, 'codex');
        if (!payload || payload.error) return inline ? `<span class="itemx-event-chip">✦ 도감 기록 복원 중</span>` : '';
        const html = decorateInlineEvent(
          codexInlineEventHtml(payload, markerMotion(`CODEX2@${ref}`)),
          payload,
          payload.event?.domain
        );
        if (html) {
          hasCodexCard = true;
          return html;
        }
        return '';
      });
    if (!found) return content;
    if (runtime.mainStyle) return rendered;
    return `<style>${ITEMX_CHIP_STYLE}${ITEMX_PRESENTATION_STYLE}${hasFullCard ? ITEMX_CHAT_STYLE : ''}${hasCodexCard ? `${ITEMX_CODEX_INLINE_STYLE}${ITEMX_CODEX_INLINE_DENSE_STYLE}${ITEMX_CODEX_INLINE_APPRAISAL_STYLE}` : ''}</style>${rendered}`;
  };

  function beginBodyScrollEffects() {
    runtime.bodyFxSawScroll = false;
    if (runtime.bodyFxStartTimer) globalThis.clearTimeout(runtime.bodyFxStartTimer);
    runtime.bodyFxStartTimer = globalThis.setTimeout(() => {
      runtime.bodyFxStartTimer = null;
      activateBodyScrollEffects();
    }, 80);
  }

  function activateBodyScrollEffects() {
    if (runtime.bodyFxScrollActive || !runtime.bodyFxClassOwner) return;
    runtime.bodyFxScrollActive = true;
    void runtime.bodyFxClassOwner.addClass('x-risu-itemx-body-scrolling').catch(() => {});
  }

  function continueBodyScrollEffects() {
    runtime.bodyFxSawScroll = true;
    if (runtime.bodyFxStartTimer) globalThis.clearTimeout(runtime.bodyFxStartTimer);
    runtime.bodyFxStartTimer = null;
    activateBodyScrollEffects();
    endBodyScrollEffects(220);
  }

  function endBodyScrollEffects(delayMs = 0) {
    if (runtime.bodyFxStartTimer) globalThis.clearTimeout(runtime.bodyFxStartTimer);
    runtime.bodyFxStartTimer = null;
    if (runtime.bodyFxScrollTimer) globalThis.clearTimeout(runtime.bodyFxScrollTimer);
    runtime.bodyFxScrollTimer = globalThis.setTimeout(() => {
      runtime.bodyFxScrollTimer = null;
      if (!runtime.bodyFxScrollActive) return;
      runtime.bodyFxScrollActive = false;
      if (runtime.bodyFxClassOwner)
        void runtime.bodyFxClassOwner.removeClass('x-risu-itemx-body-scrolling').catch(() => {});
      runtime.hostSyncDeferred = false;
      scheduleHostDomSync(180);
      if (runtime.outputSyncDeferred) {
        runtime.outputSyncDeferred = false;
        void scheduleCommittedOutputSync();
      }
    }, delayMs);
  }

  async function removeBodyEffectGovernor() {
    const owner = runtime.bodyFxEventOwner;
    if (owner)
      for (const binding of runtime.bodyFxEventIds) {
        try {
          await owner.removeEventListener(binding.type, binding.id, true);
        } catch (error) {
          debugRecord('body effect listener remove', error?.message || String(error));
        }
      }
    runtime.bodyFxEventIds = [];
    runtime.bodyFxEventOwner = null;
  }

  async function installBodyEffectGovernor() {
    if (!runtime.mainDoc) return;
    try {
      runtime.bodyFxClassOwner = (await runtime.mainDoc.querySelector('.chattext')) || runtime.bodyFxClassOwner;
      if (runtime.bodyFxEventOwner) {
        try {
          if (await runtime.bodyFxEventOwner.getParent()) return;
        } catch {}
        await removeBodyEffectGovernor();
      }
      const body = await runtime.mainDoc.querySelector('body');
      if (!body) return;
      runtime.bodyFxEventOwner = body;
      const bindings = [
        ['pointerdown', beginBodyScrollEffects],
        ['scroll', continueBodyScrollEffects],
        ['pointerup', () => endBodyScrollEffects(runtime.bodyFxSawScroll ? 220 : 40)],
        ['pointercancel', () => endBodyScrollEffects(runtime.bodyFxSawScroll ? 220 : 40)],
        ['scrollend', () => endBodyScrollEffects(40)]
      ];
      for (const [type, handler] of bindings) {
        const id = await body.addEventListener(type, handler, true);
        runtime.bodyFxEventIds.push({ type, id });
      }
    } catch (error) {
      debugRecord('body effect governor install', error?.message || String(error));
    }
  }

  async function syncMainEffectsState() {
    if (!runtime.mainDoc) return;
    try {
      const body = await runtime.mainDoc.querySelector('body');
      if (!body) return;
      if (runtime.visualEffectsEnabled) await body.removeClass('x-risu-itemx2-effects-off');
      else await body.addClass('x-risu-itemx2-effects-off');
    } catch (error) {
      debugRecord('effect setting sync', error?.message || String(error));
    }
  }

  async function syncRootFontScale(value) {
    const root = runtime.rootDrawer;
    if (!root) return;
    for (const scale of ['small', 'medium', 'large']) {
      try {
        await root.removeClass(`x-risu-itemx2-font-${scale}`);
      } catch {}
    }
    try {
      await root.addClass(`x-risu-itemx2-font-${['small', 'medium', 'large'].includes(value) ? value : 'small'}`);
    } catch {}
  }

  async function installMainStyle() {
    try {
      if (runtime.mainStyle && runtime.mainStylePosition === runtime.badgePosition) {
        try {
          if (!(await runtime.mainStyle.getParent())) throw new Error('detached style owner');
          runtime.permissions.mainDom = true;
          runtime.lastDomError = '';
          await installBodyEffectGovernor();
          await syncMainEffectsState();
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
      if (existing) {
        runtime.mainStyle = existing;
        await existing.setTextContent(mainStyleText());
        runtime.mainStylePosition = runtime.badgePosition;
        await installBodyEffectGovernor();
        await syncMainEffectsState();
        await installHostObserver();
        return true;
      }
      const style = await doc.createElement('style');
      await style.setAttribute('x-itemx2-style', 'owner');
      await style.setTextContent(mainStyleText());
      const head = await doc.querySelector('head');
      if (head) await head.appendChild(style);
      else await doc.appendChild(style);
      runtime.mainStyle = style;
      runtime.mainStylePosition = runtime.badgePosition;
      runtime.lastDomError = '';
      await installBodyEffectGovernor();
      await syncMainEffectsState();
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

  function presentationRecord(domain, id) {
    if (!runtime.presentationRecords) {
      const records = new Map(),
        chat = runtime.cachedLoaded?.chat;
      const manual = [...(replayCheckpoint(chat)?.manual || []), ...manualLedger(chat)];
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
      runtime.presentationRecords = records;
    }
    return runtime.presentationRecords.get(`${domain}:${id}`) || {};
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
    const motion = runtime.visualEffectsEnabled ? 'full' : 'off';
    const record = presentationRecord('item', item.id);
    const key = `${item.id}:${ITEMXCore.fnv1a(JSON.stringify([item, record.previous, record.review]))}:${motion}`;
    if (runtime.detailHtmlCache.has(key)) return runtime.detailHtmlCache.get(key);
    const html = `<div class="itemx2-detail-stack">${ITEMXRenderer.renderCard(item, { motion })}${detailAnnotations('item', item)}</div>`;
    runtime.detailHtmlCache.set(key, html);
    while (runtime.detailHtmlCache.size > 60)
      runtime.detailHtmlCache.delete(runtime.detailHtmlCache.keys().next().value);
    return html;
  }

  async function hydrateCheckedItemDetail(loaded) {
    if (!runtime.mainDoc || !loaded) return false;
    const detailItems = rootPageItems(loaded);
    for (let index = 0; index < detailItems.length; index += 1) {
      const selected = await runtime.mainDoc.querySelector(`#itemx2-detail-${index}:checked`);
      if (!selected) continue;
      const detail = await queryMainClass(`itemx2-root-detail-body-${index}`);
      if (detail) await detail.setInnerHTML(itemDetailHtml(detailItems[index]));
      return Boolean(detail);
    }
    return false;
  }

  function codexEntries(loaded, domain) {
    const registry = domain === 'skill' ? loaded?.codexSnapshot?.skills : loaded?.codexSnapshot?.monsters;
    return (registry?.order || [])
      .map((id) => registry.entries[id])
      .filter(Boolean)
      .slice(0, 60);
  }

  async function hydrateCheckedCodexDetail(domain, loaded) {
    if (!runtime.mainDoc || !loaded || !['skill', 'monster'].includes(domain)) return false;
    const marker = await runtime.mainDoc.querySelector(
      `.x-risu-itemx2-${domain}-entry-choice:checked ~ .x-risu-itemx2-${domain}-detail .x-risu-itemx2-codex-detail-index`
    );
    if (!marker) return false;
    const index = Number(await marker.textContent());
    const entity = codexEntries(loaded, domain)[index];
    if (!entity) return false;
    const portrait = domain === 'monster' ? loaded.portraits?.[entity.id] || '' : '';
    const detailKey = codexDetailCacheKey(domain, entity, portrait, loaded.rarityMode);
    if (runtime.rootHydratedDetail === detailKey) return true;
    const detail = await queryMainClass(`itemx2-root-${domain}-detail-body-${index}`);
    if (!detail) return false;
    await detail.setInnerHTML(
      `<span class="itemx2-codex-detail-index">${index}</span>${rootCodexDetailHtml(domain, entity, portrait, loaded.rarityMode)}`
    );
    runtime.rootHydratedDetail = detailKey;
    return true;
  }

  async function queryMainClass(className) {
    if (!runtime.mainDoc) return null;
    return (
      (await runtime.mainDoc.querySelector(`.x-risu-${className}`)) ||
      (await runtime.mainDoc.querySelector(`.${className}`))
    );
  }

  async function removeRootClickRouter() {
    const owner = runtime.rootClickOwner;
    const bindings = runtime.rootClickBindings.slice();
    if (owner)
      for (const binding of bindings) {
        try {
          await owner.removeEventListener(binding.type, binding.id, binding.capture);
        } catch (error) {
          debugRecord('root click remove', error?.message || String(error));
        }
      }
    runtime.rootClickBindings = [];
    runtime.rootClickOwner = null;
    runtime.rootClickBusy = false;
  }

  async function removeRootDrawer() {
    if (runtime.feedbackTimer) globalThis.clearTimeout(runtime.feedbackTimer);
    runtime.feedbackTimer = null;
    await removeRootClickRouter();
    try {
      if (runtime.rootDrawer) await runtime.rootDrawer.remove();
    } catch {}
    if (runtime.mainDoc) {
      try {
        const safeRoots = await runtime.mainDoc.querySelectorAll('[x-itemx2-drawer="owner"]');
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
    runtime.rootDrawer = null;
    runtime.rootOpen = false;
    runtime.rootFingerprint = '';
    runtime.rootContentReady = false;
  }

  async function mountRootLoading(label = 'ITEMX CODEX 초기화 중…') {
    if (!runtime.mainDoc) return false;
    await removeRootDrawer();
    const root = await runtime.mainDoc.createElement('div');
    await root.setAttribute('x-itemx2-drawer', 'owner');
    await root.setClassName('x-risu-itemx2-root-drawer x-risu-itemx2-booting');
    await root.setInnerHTML(
      `<div class="itemx2-boot-card" role="status" aria-live="polite"><i></i><span><strong>${ITEMXCore.esc(label)}</strong><small>화면과 모델 연결을 준비하고 있습니다.</small></span></div>`
    );
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
    } catch (error) {
      fail('loading label', error);
    }
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
      runtime.lorebookCache.key === contextKey &&
      runtime.lorebookCache.at &&
      Date.now() - runtime.lorebookCache.at < 10000
    )
      return runtime.lorebookCache.rows;
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
    runtime.lorebookCache = { key: contextKey, at: Date.now(), rows };
    return rows;
  }

  async function scanLorebookEncounters({ refresh = false, silent = false } = {}) {
    if (runtime.lorebookScanPromise) return runtime.lorebookScanPromise;
    const pending = (async () => {
      const ctx = await context();
      if (!ctx) throw new Error('현재 채팅을 찾을 수 없습니다.');
      const entries = await lorebookEntries(ctx.key, { refresh });
      const active = await context();
      if (!active || active.key !== ctx.key) throw new Error('스캔 중 채팅이 바뀌었습니다. 다시 시도하세요.');
      const scanResult = await enqueue(ctx.key, async () => {
        const latest = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
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
        if (!refresh && silent && runtime.lorebookAutoFingerprint === sourceFingerprint)
          return { changed: false, sourceFingerprint, result: { enriched: 0, removed: 0, matched: 0, ambiguous: 0 } };
        const scanned = ITEMXLorebook.scan(base, entries, previous);
        if (!scanned.result.enriched && !scanned.result.removed)
          return { ...scanned, changed: false, sourceFingerprint };
        const next = ITEMXCore.clone(latest);
        next.scriptstate = { ...(next.scriptstate || {}), [ITEMX_LORE_KEY]: JSON.stringify(scanned.ledger) };
        await Risuai.setChatToIndex(ctx.characterIndex, ctx.chatIndex, next);
        return {
          ...scanned,
          changed: true,
          sourceFingerprint: `${ctx.key}:${encounterRegistryFingerprint(base)}:${ITEMXCore.fnv1a(JSON.stringify(entries))}:${ITEMXCore.fnv1a(JSON.stringify(scanned.ledger.rows))}`
        };
      });
      const current = await context();
      if (runtime.unloading || current?.key !== ctx.key) return scanResult;
      if (scanResult.changed) {
        runtime.cachedLoaded = null;
        runtime.detailHtmlCache.clear();
        runtime.rootFingerprint = '';
        runtime.generation += 1;
        await rebuildCurrent();
      }
      const summary = scanResult.result;
      runtime.lorebookAutoFingerprint = scanResult.sourceFingerprint;
      if (!silent || summary.enriched || summary.removed)
        runtime.status = `로어북 스캔 · 보완 ${summary.enriched} · 정리 ${summary.removed} · 일치 ${summary.matched} · 모호 ${summary.ambiguous}`;
      debugRecord('lorebook scan', summary);
      if (!silent)
        await notifyUser(
          `조우 로어북 스캔 완료 · 보완 ${summary.enriched}건 · 정리 ${summary.removed}건 · 일치 ${summary.matched}건${summary.ambiguous ? ` · 모호하여 제외 ${summary.ambiguous}건` : ''}`,
          'success'
        );
      return scanResult;
    })()
      .catch(async (error) => {
        if (!silent) await notifyUser(`조우 로어북 스캔 실패: ${error.message || error}`, 'error');
        else debugRecord('automatic lorebook scan skipped', error?.message || String(error));
        return null;
      })
      .finally(() => {
        if (runtime.lorebookScanPromise === pending) runtime.lorebookScanPromise = null;
      });
    runtime.lorebookScanPromise = pending;
    return pending;
  }

  async function notifyUser(message, tone = 'error') {
    if (await showRootFeedback(message, tone, tone === 'error' ? 4200 : 2600)) return true;
    for (const name of tone === 'error'
      ? ['alertError', 'alertNormal', 'alert']
      : ['alertNormal', 'alert', 'alertError']) {
      try {
        const result = await callOptionalRisuApi(name, message);
        if (result.available) return true;
      } catch (error) {
        fail(`optional notification ${name}`, error);
      }
    }
    log(message);
    return false;
  }

  async function confirmUser(message) {
    try {
      const result = await callOptionalRisuApi('alertConfirm', message);
      if (result.available) return result.value === true;
    } catch (error) {
      fail('optional confirmation', error);
    }
    try {
      if (typeof globalThis.confirm === 'function') return globalThis.confirm(message) === true;
    } catch (error) {
      fail('browser confirmation', error);
    }
    return false;
  }

  function scheduleHostDomSync(delayMs = 320) {
    if (runtime.bodyFxScrollActive) {
      runtime.hostSyncDeferred = true;
      if (runtime.hostSyncTimer) globalThis.clearTimeout(runtime.hostSyncTimer);
      runtime.hostSyncTimer = null;
      return;
    }
    if (runtime.hostSyncTimer) globalThis.clearTimeout(runtime.hostSyncTimer);
    runtime.hostSyncTimer = globalThis.setTimeout(async () => {
      runtime.hostSyncTimer = null;
      if (runtime.bodyFxScrollActive) {
        runtime.hostSyncDeferred = true;
        return;
      }
      if (runtime.hostSyncBusy) return;
      runtime.hostSyncBusy = true;
      try {
        await installBodyEffectGovernor();
        await ensureRootInventory();
        await syncHostSettingsVisibility();
        await flushEventBursts();
      } catch (error) {
        debugRecord('host DOM sync', error?.message || String(error));
      } finally {
        runtime.hostSyncBusy = false;
      }
    }, delayMs);
  }

  async function installHostObserver() {
    if (!runtime.mainDoc || runtime.hostObserver || typeof Risuai.createMutationObserver !== 'function') return;
    try {
      const body = await runtime.mainDoc.querySelector('body');
      if (!body) return;
      runtime.hostObserver = await Risuai.createMutationObserver((recordsSafe) => {
        if (runtime.bodyFxScrollActive) {
          runtime.hostSyncDeferred = true;
          return;
        }
        void (async () => {
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
      });
      if (!runtime.hostObserver?.observe) throw new Error('Mutation observer unavailable');
      await runtime.hostObserver.observe(body, { childList: true, subtree: true });
      armRemountWatchdog();
    } catch (error) {
      try {
        await runtime.hostObserver?.disconnect();
      } catch {}
      runtime.hostObserver = null;
      armRemountWatchdog();
      debugRecord('host observer install', error?.message || String(error));
    }
  }

  function invalidateHostSettingsVisibility() {
    runtime.hostSettingsCache.at = 0;
  }

  async function hostPluginSettingsVisible() {
    if (!runtime.mainDoc || runtime.allowDrawerOverSettings) return false;
    const now = Date.now();
    if (now - runtime.hostSettingsCache.at < 750) return runtime.hostSettingsCache.visible;
    try {
      const safeTargets = await runtime.mainDoc.querySelectorAll('button,[role="button"]');
      const targets = await Risuai.unwarpSafeArray(safeTargets);
      for (const target of targets.slice(0, 96)) {
        const text = String((await target.textContent()) || '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!text.includes('ITEMX CODEX · 권한 및 설정')) continue;
        const rect = await target.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          runtime.hostSettingsCache = { at: now, visible: true };
          return true;
        }
      }
    } catch (error) {
      fail('host settings visibility', error);
    }
    runtime.hostSettingsCache = { at: now, visible: false };
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
    } catch (error) {
      fail('host settings badge visibility', error);
    }
  }

  async function setRootOpen(open) {
    if (!runtime.rootDrawer) return false;
    try {
      if (!(await runtime.rootDrawer.getParent())) {
        runtime.rootOpen = false;
        return false;
      }
      if (open) await runtime.rootDrawer.addClass('x-risu-itemx2-is-open');
      else {
        await runtime.rootDrawer.removeClass('x-risu-itemx2-is-open');
        runtime.rootOpen = false;
        runtime.allowDrawerOverSettings = false;
        invalidateHostSettingsVisibility();
        await syncHostSettingsVisibility();
      }
      runtime.rootOpen = Boolean(open);
      return true;
    } catch {
      return false;
    }
  }

  async function resetRuntimeForContext(active) {
    const nextKey = active?.key || '';
    if (runtime.activeContextKey === nextKey) return false;
    runtime.activeContextKey = nextKey;
    clearEventBursts();
    armRemountWatchdog();
    runtime.rootItemPage = 0;
    runtime.rootHydratedDetail = '';
    invalidateHostSettingsVisibility();
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
    runtime.lorebookAutoFingerprint = '';
    runtime.cleanupArmedUntil = 0;
    runtime.uiRemountAfter = 0;
    if (runtime.legacyCommitTimer) globalThis.clearTimeout(runtime.legacyCommitTimer);
    runtime.legacyCommitTimer = null;
    if (runtime.bodyFxStartTimer) globalThis.clearTimeout(runtime.bodyFxStartTimer);
    runtime.bodyFxStartTimer = null;
    if (runtime.bodyFxScrollTimer) globalThis.clearTimeout(runtime.bodyFxScrollTimer);
    runtime.bodyFxScrollTimer = null;
    if (runtime.bodyFxScrollActive && runtime.bodyFxClassOwner) {
      try {
        await runtime.bodyFxClassOwner.removeClass('x-risu-itemx-body-scrolling');
      } catch {}
    }
    runtime.bodyFxScrollActive = false;
    runtime.bodyFxSawScroll = false;
    runtime.outputSyncDeferred = false;
    runtime.hostSyncDeferred = false;
    runtime.bodyFxClassOwner = null;
    refreshLatest(active?.chat || { message: [], scriptstate: {} });
    await removeRootDrawer();
    return true;
  }

  let rootEnsurePromise = null;
  function ensureRootInventory() {
    if (runtime.unloading || runtime.bodyFxScrollActive) return Promise.resolve();
    if (rootEnsurePromise) return rootEnsurePromise;
    const pending = ensureRootInventoryNow().finally(() => {
      if (rootEnsurePromise === pending) rootEnsurePromise = null;
    });
    rootEnsurePromise = pending;
    return pending;
  }

  async function ensureRootInventoryNow() {
    if (runtime.bodyFxScrollActive) return;
    runtime.remountFallbackAt = Date.now();
    const active = await context();
    const contextChanged = await resetRuntimeForContext(active);
    if (!active) {
      runtime.status = '채팅 진입 대기';
      return;
    }
    const cached = runtime.cachedLoaded;
    const replayChanged =
      !contextChanged &&
      cached?.key === active.key &&
      cached.replayFingerprint !== replaySourceFingerprint(active.chat);
    if (runtime.remounting) return;
    if (!contextChanged && (runtime.auxActive > 0 || runtime.auxRecoveryPromise || Date.now() < runtime.uiRemountAfter))
      return;
    runtime.remounting = true;
    try {
      if (!runtime.hooks.output || !runtime.hooks.display || !runtime.hooks.before || !runtime.hooks.after)
        await installPipelineHooks();
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
        try {
          drawerAttached = Boolean(await runtime.rootDrawer.getParent());
        } catch {
          runtime.rootDrawer = null;
        }
      }
      if (!drawerAttached) {
        const safeMounted = await runtime.mainDoc.querySelectorAll('[x-itemx2-drawer="owner"]');
        const mounted = await Risuai.unwarpSafeArray(safeMounted);
        if (mounted.length === 1) {
          runtime.rootDrawer = mounted[0];
          runtime.rootOpen = Boolean(await runtime.rootDrawer.matches('.x-risu-itemx2-is-open'));
          await installRootClickRouter(runtime.rootDrawer);
        } else {
          await removeRootClickRouter();
          runtime.rootDrawer = null;
          await openRootInventory({ open: false });
          return;
        }
      }
      let styleAttached = false;
      if (runtime.mainStyle) {
        try {
          styleAttached = Boolean(await runtime.mainStyle.getParent());
        } catch {
          runtime.mainStyle = null;
        }
      }
      if (!styleAttached) {
        const style = await runtime.mainDoc.querySelector('style[x-itemx2-style="owner"]');
        if (style) runtime.mainStyle = style;
        else {
          runtime.mainStyle = null;
          await installMainStyle();
        }
      }
      if (replayChanged) {
        const loaded = await rebuildCurrent();
        if (loaded) {
          let open = false;
          try {
            open = Boolean(await runtime.rootDrawer?.matches('.x-risu-itemx2-is-open'));
          } catch {}
          await openRootInventory({ open, loaded, tab: runtime.activeRootTab });
        }
      }
    } catch (error) {
      fail('root remount', error);
    } finally {
      runtime.remounting = false;
    }
  }

  async function loadCodexPortraits(character, chat, codexSnapshot, settings) {
    const result = {},
      catalog = combinedPortraitAssets(
        character,
        await modulePortraitAssets(settings, character, chat),
        ITEMXCodex.ASSET_CATALOG_MAX
      );
    if (typeof Risuai.readImage !== 'function') return result;
    const asDataUrl = (value, ext = '') => {
      if (typeof value === 'string')
        return /^(?:blob:|https?:|data:image\/(?:png|jpeg|webp|gif|avif);base64,)/i.test(value) ? value : '';
      let bytes = null;
      if (value instanceof Uint8Array) bytes = value;
      else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
      else if (Array.isArray(value)) bytes = Uint8Array.from(value);
      else if (value?.data instanceof Uint8Array) bytes = value.data;
      if (!bytes?.length || bytes.length > 12 * 1024 * 1024) return '';
      const lower = String(ext || '').toLowerCase();
      const isoBrand =
        bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
          ? String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
          : '';
      const mime =
        bytes[0] === 0x89 && bytes[1] === 0x50
          ? 'image/png'
          : bytes[0] === 0xff && bytes[1] === 0xd8
            ? 'image/jpeg'
            : bytes[0] === 0x52 &&
                bytes[1] === 0x49 &&
                bytes[8] === 0x57 &&
                bytes[9] === 0x45 &&
                bytes[10] === 0x42 &&
                bytes[11] === 0x50
              ? 'image/webp'
              : bytes[0] === 0x47 && bytes[1] === 0x49
                ? 'image/gif'
                : ['avif', 'avis', 'mif1', 'miaf'].includes(isoBrand)
                  ? 'image/avif'
                  : {
                      png: 'image/png',
                      jpg: 'image/jpeg',
                      jpeg: 'image/jpeg',
                      webp: 'image/webp',
                      gif: 'image/gif',
                      avif: 'image/avif'
                    }[lower] || '';
      if (!mime) return '';
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      return `data:${mime};base64,${btoa(binary)}`;
    };
    const monsters = (codexSnapshot?.monsters?.order || [])
      .map((id) => codexSnapshot.monsters.entries[id])
      .filter(Boolean)
      .slice(0, 20);
    const narrative = (chat?.message || [])
      .slice(-8)
      .map((message) => ITEMXCore.messageText(message))
      .join('\n');
    let portraitCursor = 0;
    const loadNextPortrait = async () => {
      while (portraitCursor < monsters.length) {
        const monster = monsters[portraitCursor++];
        const asset = ITEMXCodex.assetForEntity(catalog, monster, narrative);
        if (!asset) continue;
        const cacheKey = `${character?.chaId || character?.id || 'character'}:${asset.id}:${asset.ext || ''}`;
        if (runtime.portraitCache.has(cacheKey)) {
          result[monster.id] = runtime.portraitCache.get(cacheKey);
          continue;
        }
        try {
          let raw = null;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              raw = await Risuai.readImage(asset.id);
              if (raw) break;
            } catch {
              raw = null;
            }
            if (attempt < 2) await delay(280 * (attempt + 1));
          }
          const image = asDataUrl(raw, asset.ext);
          if (image) {
            result[monster.id] = image;
            if (image.length <= 4 * 1024 * 1024) {
              runtime.portraitCache.set(cacheKey, image);
              runtime.portraitCacheBytes += image.length;
              while (runtime.portraitCache.size > 24 || runtime.portraitCacheBytes > 16 * 1024 * 1024) {
                const oldest = runtime.portraitCache.keys().next().value,
                  removed = runtime.portraitCache.get(oldest) || '';
                runtime.portraitCache.delete(oldest);
                runtime.portraitCacheBytes = Math.max(0, runtime.portraitCacheBytes - removed.length);
              }
            }
          }
        } catch {}
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, monsters.length) }, () => loadNextPortrait()));
    return result;
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
    const fx = ITEMXRenderer.renderSkillFx({ ...skill, affinity }, tier, runtime.visualEffectsEnabled ? 'full' : 'off');
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
      JSON.stringify([entity || {}, record.previous, record.review, runtime.visualEffectsEnabled])
    );
    return domain === 'skill'
      ? `skill:${entity?.id || ''}:${fingerprint}:${rarityMode}`
      : `monster:${entity?.id || ''}:${fingerprint}:${portraitRevision(portrait)}`;
  }
  function rootCodexDetailHtml(domain, entity, portrait = '', rarityMode = 'world') {
    const key = codexDetailCacheKey(domain, entity, portrait, rarityMode);
    if (runtime.detailHtmlCache.has(key)) return runtime.detailHtmlCache.get(key);
    const back =
      domain === 'skill'
        ? '<label class="itemx-codex-back" for="itemx2-skill-none">‹ 스킬 목록</label>'
        : '<label class="itemx-codex-back" for="itemx2-monster-none">‹ 조우 목록</label>';
    const html = unwrapCodexPage(
      domain === 'skill' ? skillPageHtml(entity, back, rarityMode) : monsterPageHtml(entity, portrait, back)
    );
    runtime.detailHtmlCache.set(key, html);
    while (runtime.detailHtmlCache.size > 60)
      runtime.detailHtmlCache.delete(runtime.detailHtmlCache.keys().next().value);
    return html;
  }

  function rootBadgeHtml() {
    const update = runtime.update.available
      ? `<span class="itemx2-update-indicator" x-itemx2-update="${ITEMXCore.esc(runtime.update.latest)}" aria-label="ITEMX CODEX 업데이트 가능">↑</span>`
      : '';
    return `<div class="itemx2-native-badge" x-itemx2-badge="launcher" aria-label="ITEMX CODEX"><img src="${ITEMX_BADGE_ICON}" alt="ITEMX CODEX">${update}</div><div class="itemx2-aux-status ${runtime.auxActive > 0 ? 'itemx2-aux-status-on' : ''}" aria-live="polite"><i></i><span class="itemx2-aux-status-label">${ITEMXCore.esc(runtime.auxLabel)}</span></div><div class="itemx2-feedback" role="status" aria-live="polite"></div>`;
  }

  const updateLabelHtml = () =>
    runtime.update.available
      ? `<span class="itemx2-update-label" x-itemx2-update="${ITEMXCore.esc(runtime.update.latest)}">UPDATE</span>`
      : '';

  function rootInventoryHtml(loaded, open = true, tab = 'inventory') {
    if (!open)
      return `${rootBadgeHtml()}<div class="itemx2-root-layer"><section class="itemx-panel itemx2-root-panel" aria-label="ITEMX CODEX"><div class="itemx2-tab-loading itemx2-open-loading" role="status" aria-live="polite"><i></i><strong>인벤토리 여는 중</strong><small>저장된 화면을 준비하고 있답니다.</small></div></section></div>`;
    const all = itemsOf(loaded.snapshot).slice(0, 60);
    const pageCount = Math.max(1, Math.ceil(all.length / ITEMX_ROOT_PAGE_SIZE));
    runtime.rootItemPage = Math.max(0, Math.min(pageCount - 1, runtime.rootItemPage));
    const pageStart = runtime.rootItemPage * ITEMX_ROOT_PAGE_SIZE;
    const inventoryPage = tab === 'inventory' ? all.slice(pageStart, pageStart + ITEMX_ROOT_PAGE_SIZE) : [];
    const skills = (loaded.codexSnapshot?.skills?.order || [])
      .map((id) => loaded.codexSnapshot.skills.entries[id])
      .filter(Boolean)
      .slice(0, 60);
    const monsters = (loaded.codexSnapshot?.monsters?.order || [])
      .map((id) => loaded.codexSnapshot.monsters.entries[id])
      .filter(Boolean)
      .slice(0, 60);
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
      ['observed', '관찰'],
      ['removed', '소실']
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
    const positionChoices =
      tab === 'settings'
        ? BADGE_POSITIONS.map(
            ([key, label]) =>
              `<button class="itemx2-position-choice itemx2-position-${key} ${runtime.badgePosition === key ? 'itemx2-position-on' : ''}" type="button">${label}</button>`
          ).join('')
        : '';
    const fontChoices =
      tab === 'settings'
        ? [
            ['small', '소'],
            ['medium', '중'],
            ['large', '대']
          ]
            .map(
              ([value, label]) =>
                `<button class="itemx2-font-choice itemx2-setting-font-${value} ${loaded.fontScale === value ? 'itemx2-font-on' : ''}" type="button">${label}</button>`
            )
            .join('')
        : '';
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
    const domainControls = [
      ['items', '무기·아이템', loaded.itemsEnabled, '감정·손상·소실'],
      ['skills', '스킬', loaded.skillsEnabled, '습득·숙련·봉인'],
      ['encounters', '전투 도감', loaded.encountersEnabled, '적대·대련·전투']
    ]
      .map(
        ([key, label, value, note]) =>
          `<button class="itemx2-domain-card itemx2-setting-domain-${key} ${value ? 'itemx2-setting-on' : ''}" type="button"><strong>${label} · ${value ? 'ON' : 'OFF'}</strong><small>${note}</small></button>`
      )
      .join('');
    const debugLog =
      runtime.debugEntries
        .slice(-12)
        .reverse()
        .map(
          (entry) =>
            `${new Date(entry.at).toLocaleTimeString('ko-KR', { hour12: false })} ${entry.where}\n${entry.detail}`
        )
        .join('\n\n') || '기록 없음';
    const debugPanel = `<details class="itemx2-manager-fold itemx2-debug-fold"><summary>디버그 진단 <small>${loaded.debugEnabled ? 'ON · 최근 30건' : 'OFF'}</small></summary><div class="itemx2-debug-body"><button class="itemx2-root-setting-button itemx2-setting-debug ${loaded.debugEnabled ? 'itemx2-setting-on' : ''}" type="button">로그 ${loaded.debugEnabled ? 'ON' : 'OFF'}</button><div class="itemx2-debug-grid"><b>문맥</b><span>${ITEMXCore.esc(loaded.key)}</span><b>세대</b><span>${runtime.generation}</span><b>스냅숏</b><span>${ITEMXCore.esc(loaded.snapshot.fingerprint || '-')} / ${ITEMXCore.esc(loaded.codexSnapshot.fingerprint || '-')}</span><b>항목</b><span>${counts.all} / ${skills.length} / ${monsters.length}</span><b>마지막 오류</b><span>${ITEMXCore.esc(runtime.lastHookError || runtime.lastDomError || '없음')}</span></div><pre class="itemx2-debug-log">${ITEMXCore.esc(debugLog)}</pre><button class="itemx2-root-setting-button itemx2-setting-debug-clear" type="button">로그 비우기</button></div></details>`;
    const cleanupArmed = runtime.cleanupArmedUntil > Date.now();
    const settings = `<div class="itemx2-root-settings"><section class="itemx2-root-setting-card"><span><strong>연결 및 권한</strong><small>첫 연결에서는 Risu가 모델 처리와 화면 접근 권한을 각각 물을 수 있습니다.</small><span class="itemx2-status-row">${chips}</span></span><button class="itemx2-root-setting-button itemx2-root-setting-button-primary itemx2-setting-connect ${runtime.connectionBusy ? 'itemx2-root-setting-button-busy' : ''}">${runtime.connectionBusy ? '확인 중…' : connection.ready ? '다시 확인' : '연결하기'}</button></section><section class="itemx2-root-setting-card"><span><strong>보조 모델 상태</strong><small class="itemx2-aux-setting-status">${ITEMXCore.esc(auxStatusText())}</small></span><button class="itemx2-root-setting-button itemx2-setting-aux-run" ${runtime.auxActive > 0 ? 'disabled' : ''}>${runtime.auxActive > 0 ? '처리 중…' : '지금 검사'}</button></section><section class="itemx2-root-setting-card"><span><strong>기능별 추적</strong><small>OFF는 새 수집만 멈추며 기존 기록은 보존합니다.</small></span></section><div class="itemx2-domain-grid">${domainControls}</div><section class="itemx2-root-setting-card"><span><strong>사이드 배지 위치</strong><small>선택 즉시 배지와 패널이 이동하고 저장됩니다.</small></span></section><div class="itemx2-position-grid">${positionChoices}</div>${manager}<section class="itemx2-root-setting-card"><span><strong>현재 봇 ITEMX CODEX</strong><small>${enabled ? '활성 상태입니다.' : '현재 봇에서 비활성 상태입니다.'}</small></span><button class="itemx2-root-setting-button itemx2-setting-toggle">${enabled ? 'ON' : 'OFF'}</button></section><section class="itemx2-root-setting-card"><span><strong>메인 출력</strong><small>메인 모델에 활성화된 기능의 규약만 주입합니다.</small></span><button class="itemx2-root-setting-button itemx2-setting-main">${loaded.mainOutput ? 'ON' : 'OFF'}</button></section><section class="itemx2-root-setting-card"><span><strong>보조 출력</strong><small>새 설치에서는 OFF입니다. Risu의 기타 보조모델을 설정한 뒤 누락 복구 또는 항상 검사를 직접 선택하세요.</small></span><button class="itemx2-root-setting-button itemx2-setting-aux">${AUX_LABELS[loaded.auxOutput] || AUX_LABELS.off}</button></section><section class="itemx2-root-setting-card"><span><strong>등급 기준</strong><small>아이템과 스킬의 세계관 등급명은 보존하고 내부 시각 등급의 판정 기준을 선택합니다.</small></span><button class="itemx2-root-setting-button itemx2-setting-rarity ${loaded.rarityMode === 'itemx' ? 'itemx2-setting-on' : ''}">${RARITY_MODE_LABELS[loaded.rarityMode] || RARITY_MODE_LABELS.world}</button></section><section class="itemx2-root-setting-card"><span><strong>시각 이펙트</strong><small>본문 카드·인벤토리·스킬·조우의 장식 효과를 한 번에 켜거나 끕니다.</small></span><button class="itemx2-root-setting-button itemx2-setting-effects ${loaded.effectsEnabled ? 'itemx2-setting-on' : ''}">${loaded.effectsEnabled ? 'ON' : 'OFF'}</button></section><section class="itemx2-root-setting-card"><span><strong>모듈 에셋 초상화</strong><small>활성 모듈의 캐릭터 에셋을 조우 초상화 후보에 더합니다. 권한·탐색·이미지 로드 실패 시 이모지로 표시합니다.</small></span><button class="itemx2-root-setting-button itemx2-setting-module-assets ${loaded.moduleAssetsEnabled ? 'itemx2-setting-on' : ''}">${loaded.moduleAssetsEnabled ? 'ON' : 'OFF'}</button></section><section class="itemx2-root-setting-card"><span><strong>조우 로어북 보완</strong><small>캐릭터·현재 채팅·활성 모듈 로어북에서 실제 등록된 조우만 정확 일치로 보완합니다. 모델 토큰은 사용하지 않습니다.</small></span><span class="itemx2-manager-actions"><button class="itemx2-root-setting-button itemx2-setting-lorebook ${loaded.lorebookEncounterEnabled ? 'itemx2-setting-on' : ''}" type="button">${loaded.lorebookEncounterEnabled ? '자동 ON' : '자동 OFF'}</button><button class="itemx2-root-setting-button itemx2-setting-lorebook-scan" type="button">지금 스캔</button></span></section><section class="itemx2-root-setting-card"><span><strong>글자 크기</strong><small>인벤토리·스킬·조우의 주요 글자만 즉시 조절합니다.</small></span></section><div class="itemx2-font-grid">${fontChoices}</div><section class="itemx2-root-setting-card"><span><strong>채팅 저장소</strong><small>${counts.all}개 · ${ITEMXCore.esc(runtime.status)}</small></span><button class="itemx2-root-setting-button itemx2-setting-rebuild">재구축</button></section><section class="itemx2-root-setting-card"><span><strong>현재 채팅 ITEMX 기록 제거</strong><small>현재 봇을 OFF로 바꾸고, 이 채팅 본문의 마커와 ITEMX/CODEX 원장을 삭제합니다. 되돌릴 수 없습니다.</small></span><button class="itemx2-root-setting-button itemx2-setting-cleanup ${cleanupArmed ? 'itemx2-setting-cleanup-armed' : ''}">${cleanupArmed ? '다시 눌러 완전 제거' : '현재 채팅 정리'}</button></section>${debugPanel}<section class="itemx2-root-setting-card"><span><strong>플러그인</strong><small>ITEMX CODEX ${ITEMX_PLUGIN_VERSION}</small></span></section></div>`;
    const pager =
      pageCount > 1
        ? `<span class="itemx2-root-pager"><button class="itemx2-root-page-prev" type="button" ${runtime.rootItemPage === 0 ? 'disabled' : ''}>‹</button><b>${runtime.rootItemPage + 1} / ${pageCount}</b><button class="itemx2-root-page-next" type="button" ${runtime.rootItemPage >= pageCount - 1 ? 'disabled' : ''}>›</button></span>`
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
    const headerStatus = `${enabled ? `보유 ${counts.owned} · 장착 ${counts.equipped} · 관찰 ${counts.observed}` : '현재 봇 비활성'} · ${ITEMXCore.esc(runtime.status)}`;
    return `${controls}${rootBadgeHtml()}<div class="itemx2-root-layer"><section class="itemx-panel itemx2-root-panel" aria-label="ITEMX CODEX"><input class="itemx2-root-control" id="itemx2-detail-none" name="itemx2-detail" type="radio" checked><header class="itemx-ph"><span class="itemx-ph-text"><span class="itemx-ph-eyebrow">ITEMX CODEX · ${ITEMX_VERSION_LABEL}${updateLabelHtml()}</span><span class="itemx-ph-title">${ITEMXCore.esc(loaded.character.name || '인벤토리')}</span><span class="itemx-ph-sub"><!--ITEMX2-HEADER-START-->${headerStatus}<!--ITEMX2-HEADER-END--></span></span><button class="itemx-ph-btn itemx2-root-close" type="button" aria-label="닫기">✕</button></header><nav class="itemx-main-tabs"><!--ITEMX2-NAV-START-->${tabs}<!--ITEMX2-NAV-END--></nav><div class="itemx2-root-tab-body"><!--ITEMX2-BODY-START-->${activeContent}<!--ITEMX2-BODY-END--></div></section></div>`;
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
    if (!runtime.mainDoc || !runtime.rootDrawer) return false;
    const regions = rootInventoryRegions(html);
    if (regions.header == null || regions.nav == null || regions.body == null) return false;
    const header = await runtime.mainDoc.querySelector('.x-risu-itemx-ph-sub');
    const nav = await runtime.mainDoc.querySelector('.x-risu-itemx-main-tabs');
    const body = await runtime.mainDoc.querySelector('.x-risu-itemx2-root-tab-body');
    if (!header || !nav || !body) return false;
    try {
      await header.setInnerHTML(regions.header);
      await nav.setInnerHTML(regions.nav);
      await body.setInnerHTML(regions.body);
      runtime.rootHydratedDetail = '';
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
      Number(loaded.debugEnabled)
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
    if (!owner || (runtime.rootClickOwner === owner && runtime.rootClickBindings.length)) return;
    await removeRootClickRouter();
    const routeBadge = async (event) => {
      try {
        const badge = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-native-badge'));
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
        const cacheReady = loaded.key === runtime.activeContextKey && runtime.cachedGeneration === runtime.generation;
        if (runtime.rootContentReady && cacheReady && runtime.rootFingerprint === rootStateFingerprint(loaded))
          return true;
        await openRootInventory({ open: true, loaded, tab: runtime.activeRootTab });
        return true;
      } catch (error) {
        fail('native badge click', error);
        return true;
      }
    };
    const routeControls = async (event) => {
      try {
        if (!runtime.rootOpen) return;
        const close = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-root-close'));
        if (close) {
          const closeRect = await close.getBoundingClientRect();
          if (
            event.clientX >= closeRect.left &&
            event.clientX <= closeRect.right &&
            event.clientY >= closeRect.top &&
            event.clientY <= closeRect.bottom
          ) {
            await setRootOpen(false);
            return;
          }
        }
        for (const [tab, label] of [
          ['inventory', '인벤토리'],
          ['skills', '스킬'],
          ['bestiary', '조우 도감'],
          ['settings', '설정']
        ]) {
          const button = runtime.mainDoc && (await runtime.mainDoc.querySelector(`.x-risu-itemx2-root-tab-${tab}`));
          if (!button) continue;
          const rect = await button.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            continue;
          if (runtime.rootTabBusy || runtime.activeRootTab === tab) return;
          runtime.rootTabBusy = true;
          try {
            if (tab === 'inventory') runtime.rootItemPage = 0;
            const body = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-root-tab-body'));
            if (body)
              await body.setInnerHTML(
                `<div class="itemx2-tab-loading" role="status" aria-live="polite"><i></i><strong>${label} 불러오는 중</strong><small>선택한 탭만 준비하고 있답니다.</small></div>`
              );
            await delay(24);
            await openRootInventory({ open: true, tab });
          } finally {
            runtime.rootTabBusy = false;
          }
          return;
        }
        for (const [direction, selector] of [
          [-1, '.x-risu-itemx2-root-page-prev'],
          [1, '.x-risu-itemx2-root-page-next']
        ]) {
          const button = runtime.mainDoc && (await runtime.mainDoc.querySelector(selector));
          if (!button) continue;
          const rect = await button.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            continue;
          if (runtime.rootTabBusy) return;
          const loaded = await cachedOrRebuildCurrent();
          if (!loaded) return;
          const pageCount = Math.max(
            1,
            Math.ceil(Math.min(60, itemsOf(loaded.snapshot).length) / ITEMX_ROOT_PAGE_SIZE)
          );
          const nextPage = Math.max(0, Math.min(pageCount - 1, runtime.rootItemPage + direction));
          if (nextPage === runtime.rootItemPage) return;
          runtime.rootItemPage = nextPage;
          runtime.rootTabBusy = true;
          try {
            const body = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-root-tab-body'));
            if (body)
              await body.setInnerHTML(
                '<div class="itemx2-tab-loading" role="status" aria-live="polite"><i></i><strong>아이템 불러오는 중</strong><small>16개씩 나누어 준비하고 있답니다.</small></div>'
              );
            await delay(24);
            await openRootInventory({ open: true, tab: 'inventory', loaded });
          } finally {
            runtime.rootTabBusy = false;
          }
          return;
        }
        if (runtime.activeRootTab === 'inventory') {
          const cached = runtime.cachedLoaded;
          const cacheReady =
            cached && cached.key === runtime.activeContextKey && runtime.cachedGeneration === runtime.generation;
          const loaded = cacheReady ? cached : await cachedOrRebuildCurrent();
          if (loaded && (await eventHitsMainClass(event, 'itemx2-repair-one'))) {
            const items = rootPageItems(loaded);
            for (let index = 0; index < items.length; index++) {
              if (!(await runtime.mainDoc.querySelector(`#itemx2-detail-${index}:checked`))) continue;
              try {
                const refreshed = await repairOneItem(loaded, items[index].id);
                const detail = await queryMainClass(`itemx2-root-detail-body-${index}`);
                const item = refreshed?.snapshot?.registry?.items?.[items[index].id];
                if (runtime.activeContextKey === loaded.key && detail && item)
                  await detail.setInnerHTML(itemDetailHtml(item));
              } catch (error) {
                await notifyUser(error.message || String(error), 'error');
              }
              return;
            }
          }
          if (loaded && loaded.key === runtime.activeContextKey) {
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
        if (runtime.activeRootTab === 'skills' || runtime.activeRootTab === 'bestiary') {
          const cached = runtime.cachedLoaded;
          const cacheReady =
            cached && cached.key === runtime.activeContextKey && runtime.cachedGeneration === runtime.generation;
          const loaded = cacheReady ? cached : await cachedOrRebuildCurrent();
          if (loaded && loaded.key === runtime.activeContextKey) {
            await delay(0);
            const domain = runtime.activeRootTab === 'skills' ? 'skill' : 'monster';
            if (await hydrateCheckedCodexDetail(domain, loaded)) return;
          }
          return;
        }
        if (runtime.activeRootTab !== 'settings') return;
        const managerFold = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-manager-fold'));
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
                  runtime.status = note ? '정보 수정 감정 중' : '아이템 재감정 중';
                  try {
                    const itemEvent = await runItemModel('reroll', loaded, target, note);
                    await commitManualEvents(loaded, [itemEvent], note ? '정보 수정' : '재감정');
                  } catch (error) {
                    runtime.status = '재감정 실패';
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
                    runtime.status = '수동 제거 실패';
                    await notifyUser(`ITEMX CODEX: ${error.message || error}`, 'error');
                  }
                  await openRootInventory({ open: true, tab: 'settings' });
                  return;
                }
              }
              const create =
                runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-manager-create-button'));
              if (create) {
                const rect = await create.getBoundingClientRect();
                if (
                  event.clientX >= rect.left &&
                  event.clientX <= rect.right &&
                  event.clientY >= rect.top &&
                  event.clientY <= rect.bottom
                ) {
                  const createNoteElement =
                    runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-manager-create-note'));
                  const createNote = (await createNoteElement?.textContent())?.trim() || '';
                  if (!createNote) {
                    await notifyUser('ITEMX CODEX: 생성할 아이템 설명을 입력하세요.', 'error');
                    return;
                  }
                  runtime.status = '신규 아이템 생성 중';
                  try {
                    const itemEvent = await runItemModel('create', loaded, null, createNote);
                    await commitManualEvents(loaded, [itemEvent], '신규 생성');
                  } catch (error) {
                    runtime.status = '아이템 생성 실패';
                    await notifyUser(`ITEMX CODEX: ${error.message || error}`, 'error');
                  }
                  await openRootInventory({ open: true, tab: 'settings' });
                  return;
                }
              }
            }
          }
        }
        const connect = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-connect'));
        if (connect) {
          const rect = await connect.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            if (runtime.connectionBusy) return;
            runtime.connectionBusy = true;
            runtime.status = '연결 및 권한 확인 중';
            await updateConnectionUi();
            await showRootFeedback('ITEMX CODEX 연결과 권한을 확인하는 중입니다…', 'working', 0);
            try {
              const connected = await installPipelineHooks({ prompt: true });
              const styled = await installMainStyle();
              runtime.status =
                connected && styled ? '연결 및 권한 정상' : connected ? '화면 연결 실패' : '모델 훅 연결 실패';
              if (connected && styled) {
                await showRootFeedback('ITEMX CODEX 연결 및 권한 확인 완료', 'success');
              } else {
                await showRootFeedback(
                  `연결 확인 실패 · ${(!connected ? runtime.lastHookError : runtime.lastDomError) || runtime.status}`,
                  'error',
                  3600
                );
              }
              if (!connected || !styled)
                await notifyUser(
                  `ITEMX CODEX 연결 확인 실패: ${(!connected ? runtime.lastHookError : runtime.lastDomError) || runtime.status}`,
                  'error'
                );
            } finally {
              runtime.connectionBusy = false;
              await updateConnectionUi();
            }
            return;
          }
        }
        const auxRun = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-aux-run'));
        if (auxRun) {
          const rect = await auxRun.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            if (runtime.auxActive > 0) return;
            runtime.status = '보조 모델 수동 검사 중';
            await recoverAuxiliaryOutput({ force: true });
            return;
          }
        }
        for (const [key, label] of BADGE_POSITIONS) {
          const choice = runtime.mainDoc && (await runtime.mainDoc.querySelector(`.x-risu-itemx2-position-${key}`));
          if (!choice) continue;
          const rect = await choice.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            continue;
          runtime.badgePosition = key;
          await Risuai.pluginStorage.setItem('badgePosition', key);
          runtime.status = `배지 위치 · ${label}`;
          if (runtime.rootDrawer) {
            for (const [other] of BADGE_POSITIONS) await runtime.rootDrawer.removeClass(`x-risu-itemx2-pos-${other}`);
            await runtime.rootDrawer.addClass(`x-risu-itemx2-pos-${key}`);
          }
          await installMainStyle();
          for (const [other] of BADGE_POSITIONS) {
            const button = runtime.mainDoc && (await runtime.mainDoc.querySelector(`.x-risu-itemx2-position-${other}`));
            if (!button) continue;
            if (other === key) await button.addClass('x-risu-itemx2-position-on');
            else await button.removeClass('x-risu-itemx2-position-on');
          }
          return;
        }
        const toggle = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-toggle'));
        if (toggle) {
          const rect = await toggle.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
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
        const main = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-main'));
        for (const [domain, key, label] of [
          ['items', 'itemsEnabled', '무기·아이템'],
          ['skills', 'skillsEnabled', '스킬'],
          ['encounters', 'encountersEnabled', '전투 도감']
        ]) {
          const button =
            runtime.mainDoc && (await runtime.mainDoc.querySelector(`.x-risu-itemx2-setting-domain-${domain}`));
          if (!button) continue;
          const rect = await button.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            continue;
          await applyRootSetting(async () => {
            const loaded = await rebuildCurrent();
            if (!loaded) return;
            const current = await outputSettings(loaded.character),
              value = !current[key];
            await setDomainEnabled(loaded.character, domain, value);
            runtime.cachedLoaded = null;
            runtime.status = `${label} · ${value ? 'ON' : 'OFF'}`;
            await openRootInventory({ open: true, tab: 'settings' });
          });
          return;
        }
        const debug = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-debug'));
        if (debug) {
          const rect = await debug.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            await applyRootSetting(async () => {
              const loaded = await rebuildCurrent();
              if (!loaded) return;
              const value = !(await outputSettings(loaded.character)).debugEnabled;
              await setDebugEnabled(loaded.character, value);
              runtime.cachedLoaded = null;
              runtime.status = `디버그 로그 · ${value ? 'ON' : 'OFF'}`;
              await openRootInventory({ open: true, tab: 'settings' });
            });
            return;
          }
        }
        const debugClear =
          runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-debug-clear'));
        if (debugClear) {
          const rect = await debugClear.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            runtime.debugEntries = [];
            runtime.status = '디버그 로그 비움';
            await openRootInventory({ open: true, tab: 'settings' });
            return;
          }
        }
        if (main) {
          const rect = await main.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
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
        const aux = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-aux'));
        if (aux) {
          const rect = await aux.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
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
        const rarity = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-rarity'));
        if (rarity) {
          const rect = await rarity.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            await applyRootSetting(async () => {
              const loaded = await rebuildCurrent();
              if (!loaded) return;
              const current = (await outputSettings(loaded.character)).rarityMode;
              const value = current === 'itemx' ? 'world' : 'itemx';
              await setRarityMode(loaded.character, value);
              runtime.status = `등급 기준 · ${RARITY_MODE_LABELS[value]}`;
              loaded.rarityMode = value;
              runtime.rootFingerprint = '';
              await openRootInventory({ open: true, loaded });
            });
            return;
          }
        }
        const effects = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-effects'));
        if (effects) {
          const rect = await effects.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            await applyRootSetting(async () => {
              const loaded = await cachedOrRebuildCurrent();
              if (!loaded) return;
              const value = !(cachedSettings(loaded.character) || (await outputSettings(loaded.character)))
                .effectsEnabled;
              await setEffectsEnabled(loaded.character, value);
              loaded.effectsEnabled = value;
              runtime.status = `시각 이펙트 · ${value ? 'ON' : 'OFF'}`;
              await openRootInventory({ open: true, tab: 'settings', loaded });
            });
            return;
          }
        }
        const moduleAssets =
          runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-module-assets'));
        const lorebookToggle =
          runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-lorebook'));
        if (lorebookToggle) {
          const rect = await lorebookToggle.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            await applyRootSetting(async () => {
              const loaded = await cachedOrRebuildCurrent();
              if (!loaded) return;
              const value = !(cachedSettings(loaded.character) || (await outputSettings(loaded.character)))
                .lorebookEncounterEnabled;
              await setLorebookEncounterEnabled(loaded.character, value);
              loaded.lorebookEncounterEnabled = value;
              runtime.status = `조우 로어북 자동 보완 · ${value ? 'ON' : 'OFF'}`;
              if (value) await scanLorebookEncounters({ refresh: true, silent: true });
              await openRootInventory({ open: true, tab: 'settings' });
            });
            return;
          }
        }
        const lorebookScan =
          runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-lorebook-scan'));
        if (lorebookScan) {
          const rect = await lorebookScan.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            await scanLorebookEncounters({ refresh: true });
            await openRootInventory({ open: true, tab: 'settings' });
            return;
          }
        }
        if (moduleAssets) {
          const rect = await moduleAssets.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            await applyRootSetting(async () => {
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
              runtime.status = value
                ? '모듈 에셋 초상화 · ON'
                : current.moduleAssetsEnabled
                  ? '모듈 에셋 초상화 · OFF'
                  : '모듈 에셋 권한 없음 · 이모지 폴백';
              runtime.rootFingerprint = '';
              await openRootInventory({ open: true, tab: 'settings', loaded });
            });
            return;
          }
        }
        for (const [value, label] of [
          ['small', '소'],
          ['medium', '중'],
          ['large', '대']
        ]) {
          const font = runtime.mainDoc && (await runtime.mainDoc.querySelector(`.x-risu-itemx2-setting-font-${value}`));
          if (!font) continue;
          const rect = await font.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            continue;
          await applyRootSetting(async () => {
            const loaded = await cachedOrRebuildCurrent();
            if (!loaded) return;
            await setFontScale(loaded.character, value);
            loaded.fontScale = value;
            runtime.status = `글자 크기 · ${label}`;
            for (const scale of ['small', 'medium', 'large']) {
              const button = await runtime.mainDoc.querySelector(`.x-risu-itemx2-setting-font-${scale}`);
              if (!button) continue;
              if (scale === value) await button.addClass('x-risu-itemx2-font-on');
              else await button.removeClass('x-risu-itemx2-font-on');
            }
          });
          return;
        }
        const cleanup = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-cleanup'));
        if (cleanup) {
          const rect = await cleanup.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            if (runtime.cleanupArmedUntil <= Date.now()) {
              runtime.cleanupArmedUntil = Date.now() + 7000;
              runtime.status = '정리 확인 대기 · 7초 안에 다시 누르세요';
              await showRootFeedback(
                '되돌릴 수 없습니다. 7초 안에 정리 버튼을 다시 누르면 현재 봇을 끄고 이 채팅 기록만 제거합니다.',
                'error',
                6500
              );
              await openRootInventory({ open: true, tab: 'settings' });
              return;
            }
            runtime.status = '현재 채팅 ITEMX 기록 정리 중';
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
              runtime.cleanupArmedUntil = 0;
              runtime.status = '현재 채팅 정리 실패';
              await showRootFeedback(`정리 실패 · ${error.message || error}`, 'error', 4200);
              await notifyUser(`ITEMX CODEX 정리 실패: ${error.message || error}`, 'error');
            }
            return;
          }
        }
        const rebuild = runtime.mainDoc && (await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-rebuild'));
        if (rebuild) {
          const rect = await rebuild.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            runtime.cachedLoaded = null;
            const loaded = await rebuildCurrent();
            if (loaded) await openRootInventory({ open: true, tab: 'settings', loaded });
          }
        }
      } catch (error) {
        fail('native setting click', error);
      }
    };
    const id = await owner.addEventListener(
      'click',
      async (event) => {
        if (runtime.rootClickBusy) return;
        runtime.rootClickBusy = true;
        try {
          if (await routeBadge(event)) return;
          await routeControls(event);
        } catch (error) {
          fail('root click router', error);
        } finally {
          runtime.rootClickBusy = false;
        }
      },
      true
    );
    runtime.rootClickOwner = owner;
    runtime.rootClickBindings = [{ type: 'click', id, capture: true }];
  }

  async function openRootInventory(options = {}) {
    return enqueue('ui:root-drawer', () => openRootInventoryNow(options));
  }

  async function openRootInventoryNow({ open = true, tab = 'inventory', loaded: suppliedLoaded = null } = {}) {
    try {
      runtime.panelOpen = false;
      try {
        await Risuai.hideContainer();
      } catch {}
      const loaded = suppliedLoaded || (await cachedOrRebuildCurrent());
      if (!loaded) throw new Error('No active chat context');
      if (runtime.activeContextKey && runtime.activeContextKey !== loaded.key) return;
      loaded.enabled = await isEnabled(loaded.character);
      Object.assign(loaded, await outputSettings(loaded.character));
      runtime.debugEnabled = loaded.debugEnabled;
      loaded.portraits =
        tab === 'bestiary' && loaded.encountersEnabled
          ? await loadCodexPortraits(loaded.character, loaded.chat, loaded.codexSnapshot, loaded)
          : {};
      const styled = await installMainStyle({ prompt: true });
      if (!styled || !runtime.mainDoc) {
        runtime.status = '메인 화면 권한 필요';
        await notifyUser('ITEMX CODEX를 열려면 메인 화면 권한이 필요합니다.', 'error');
        return;
      }
      let root = runtime.rootDrawer,
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
        root = await runtime.mainDoc.createElement('div');
      }
      await root.setAttribute('x-itemx2-drawer', 'owner');
      await root.setClassName(
        `x-risu-itemx2-root-drawer x-risu-itemx2-pos-${runtime.badgePosition} x-risu-itemx2-font-${loaded.fontScale || 'small'}${open ? ' x-risu-itemx2-is-open' : ''}${loaded.effectsEnabled ? '' : ' x-risu-itemx2-effects-off'}`
      );
      const html = rootInventoryHtml(loaded, open, tab);
      const regionUpdated = attached && open && runtime.rootContentReady && (await updateRootRegions(html));
      if (!regionUpdated) {
        await root.setInnerHTML(html);
        runtime.rootHydratedDetail = '';
      }
      if (!attached) {
        const body = await runtime.mainDoc.querySelector('body');
        if (!body) throw new Error('Main document body unavailable');
        if (runtime.activeContextKey !== loaded.key) return;
        await body.appendChild(root);
        if (runtime.activeContextKey !== loaded.key) {
          await root.remove();
          return;
        }
      }
      runtime.rootDrawer = root;
      runtime.rootOpen = Boolean(open);
      runtime.rootFingerprint = rootStateFingerprint(loaded);
      runtime.rootContentReady = open;
      runtime.activeRootTab = tab;
      await installRootClickRouter(root);
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
      selected = ui.selected && all.find((item) => item.id === ui.selected);
    const counts = {
      all: all.length,
      owned: all.filter((item) => item.possession === 'owned').length,
      equipped: all.filter((item) => item.location === 'equipped').length,
      observed: all.filter((item) => item.possession === 'observed').length,
      removed: all.filter((item) => item.possession === 'removed').length
    };
    const visible = ui.tab === 'inventory' ? all.filter(matches).slice(0, 60) : [];
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
        ? `<div class="itemx-body"><button class="itemx-back" data-action="back">‹ 목록으로</button><div class="itemx-detail">${ITEMXRenderer.renderCard(selected, { motion: ui.motion && runtime.visualEffectsEnabled ? 'full' : 'off' })}${detailAnnotations('item', selected)}</div></div>`
        : `<nav class="itemx-seg">${[
            ['all', '전체'],
            ['owned', '보유'],
            ['equipped', '장착'],
            ['observed', '관찰'],
            ['removed', '소실']
          ]
            .map(
              ([key, label]) =>
                `<button class="itemx-seg-i ${ui.filter === key ? 'itemx-seg-on' : ''}" data-filter="${key}">${label} <span class="itemx-seg-n">${counts[key]}</span></button>`
            )
            .join(
              ''
            )}</nav><div class="itemx-tools"><button class="itemx-tool" data-action="motion">${ui.motion ? '✦ 모션' : '◇ 정지'}</button><input class="itemx-search itemx-search-input" value="${ITEMXCore.esc(ui.query)}" placeholder="검색" aria-label="검색"><button class="itemx-tool" data-action="rebuild">↻</button></div><div class="itemx-body"><div class="itemx-grid">${visible.map(ITEMXRenderer.renderTile).join('') || '<div class="itemx-empty">표시할 아이템이 없답니다.</div>'}</div></div><footer class="itemx-pf">${visible.length}점 표시${all.filter(matches).length > 60 ? ' · 첫 60점' : ''}</footer>`;
    const permissionLabel =
      runtime.permissions.replacer === true
        ? '연결됨'
        : runtime.permissions.replacer === false
          ? '권한 필요'
          : '확인 중';
    const styleLabel =
      runtime.permissions.mainDom === true
        ? '고정 스타일'
        : runtime.permissions.mainDom === false
          ? '본문 폴백'
          : '확인 중';
    const positionOptions = BADGE_POSITIONS.map(
      ([value, label]) =>
        `<option value="${value}" ${runtime.badgePosition === value ? 'selected' : ''}>${label}</option>`
    ).join('');
    const managerContent = `<section class="itemx-manager"><div class="itemx-manager-title">아이템 운영 도구</div><label class="itemx-manager-field"><span>대상 아이템</span><select data-action="manage-select" ${all.length ? '' : 'disabled'}>${manageOptions || '<option>아이템 없음</option>'}</select></label><label class="itemx-manager-field"><span>수정 지시 · 비워두면 순수 재감정</span><textarea data-action="manage-note" placeholder="예: 이름은 그대로 두고 내구도를 31/100으로, 화염 속성은 제거"></textarea></label><div class="itemx-manager-actions"><button class="itemx-tool" data-action="manage-reroll" ${managed ? '' : 'disabled'}>🔄 정보 수정·재감정</button><button class="itemx-tool itemx-manager-danger" data-action="manage-remove" ${managed && managed.possession !== 'removed' ? '' : 'disabled'}>🗑 수동 제거</button></div><div class="itemx-manager-current">${managed ? `${ITEMXCore.esc(managed.name)} · ${ITEMXCore.esc(managed.displayRarity || managed.rarity)} · ${ITEMXCore.esc(managed.possession)} / ${ITEMXCore.esc(managed.location)}` : '선택 가능한 아이템이 없습니다.'}</div><label class="itemx-manager-field"><span>신규 아이템 생성 지시</span><textarea data-action="create-note" placeholder="예: 주인공이 획득한 번개 속성의 희귀 장검"></textarea></label><button class="itemx-tool" data-action="manage-create">＋ 신규 아이템 생성 시도</button><small class="itemx-manager-help">보조 모델 결과는 ITEMX 엄격 파서와 id 검증을 통과한 경우에만 채팅별 사건 원장에 반영됩니다.</small></section>`;
    const domainControls = [
      ['items', '무기·아이템', loaded.itemsEnabled],
      ['skills', '스킬', loaded.skillsEnabled],
      ['encounters', '전투 도감', loaded.encountersEnabled]
    ]
      .map(
        ([key, label, value]) =>
          `<button class="itemx-tool ${value ? 'itemx-setting-on' : ''}" data-action="domain-${key}">${label} ${value ? 'ON' : 'OFF'}</button>`
      )
      .join('');
    const debugLog =
      runtime.debugEntries
        .slice(-12)
        .reverse()
        .map(
          (entry) =>
            `${new Date(entry.at).toLocaleTimeString('ko-KR', { hour12: false })} ${entry.where}\n${entry.detail}`
        )
        .join('\n\n') || '기록 없음';
    const debugContent = `<details class="itemx-codex-fold"><summary><strong>디버그 진단 · ${loaded.debugEnabled ? 'ON' : 'OFF'}</strong><small>훅·스냅숏·최근 로그</small></summary><div class="itemx-codex-detail"><span>문맥 ${ITEMXCore.esc(loaded.key)}</span><span>스냅숏 ${ITEMXCore.esc(loaded.snapshot.fingerprint || '-')} / ${ITEMXCore.esc(loaded.codexSnapshot.fingerprint || '-')}</span><span>오류 ${ITEMXCore.esc(runtime.lastHookError || runtime.lastDomError || '없음')}</span><div class="itemx-manager-actions"><button class="itemx-tool ${loaded.debugEnabled ? 'itemx-setting-on' : ''}" data-action="debug-toggle">로그 ${loaded.debugEnabled ? 'ON' : 'OFF'}</button><button class="itemx-tool" data-action="debug-clear">비우기</button></div><pre class="itemx-debug-log">${ITEMXCore.esc(debugLog)}</pre></div></details>`;
    const cleanupArmed = runtime.cleanupArmedUntil > Date.now();
    const settingsContent = `<div class="itemx-settings">${managerContent}<section class="itemx-setting-card"><span><strong>기능별 추적</strong><small>OFF는 새 수집만 멈추며 기존 기록은 보존합니다.</small></span></section><div class="itemx-domain-controls">${domainControls}</div><section class="itemx-setting-card"><span><strong>현재 봇 ITEMX CODEX</strong><small>${enabled ? '활성 상태입니다.' : '모든 모델 규약과 처리를 멈춥니다.'}</small></span><button class="itemx-tool ${enabled ? 'itemx-setting-on' : ''}" data-action="toggle">${enabled ? 'ON' : 'OFF'}</button></section><section class="itemx-setting-card"><span><strong>메인 출력</strong><small>활성화된 기능의 규약만 주입합니다.</small></span><button class="itemx-tool ${loaded.mainOutput ? 'itemx-setting-on' : ''}" data-action="main-output">${loaded.mainOutput ? 'ON' : 'OFF'}</button></section><section class="itemx-setting-card"><span><strong>보조 출력</strong><small>새 설치에서는 OFF입니다. Risu의 기타 보조모델을 설정한 뒤 직접 켜세요.</small></span><button class="itemx-tool" data-action="aux-output">${AUX_LABELS[loaded.auxOutput] || AUX_LABELS.off}</button></section><section class="itemx-setting-card"><span><strong>등급 기준</strong><small>아이템과 스킬의 세계관 등급명은 보존하고 내부 시각 등급의 판정 기준을 선택합니다.</small></span><button class="itemx-tool ${loaded.rarityMode === 'itemx' ? 'itemx-setting-on' : ''}" data-action="rarity-mode">${RARITY_MODE_LABELS[loaded.rarityMode] || RARITY_MODE_LABELS.world}</button></section><section class="itemx-setting-card"><span><strong>시각 이펙트</strong><small>본문 카드·인벤토리·스킬·조우 효과를 한 번에 제어합니다.</small></span><button class="itemx-tool ${loaded.effectsEnabled ? 'itemx-setting-on' : ''}" data-action="effects">${loaded.effectsEnabled ? 'ON' : 'OFF'}</button></section><section class="itemx-setting-card"><span><strong>모듈 에셋 초상화</strong><small>활성 모듈 에셋을 사용하며 실패하면 이모지로 표시합니다.</small></span><button class="itemx-tool ${loaded.moduleAssetsEnabled ? 'itemx-setting-on' : ''}" data-action="module-assets">${loaded.moduleAssetsEnabled ? 'ON' : 'OFF'}</button></section><section class="itemx-setting-card"><span><strong>조우 로어북 보완</strong><small>캐릭터·현재 채팅·활성 모듈 로어북에서 등록된 조우만 정확 일치로 보완하며 모델 토큰은 사용하지 않습니다.</small></span><span class="itemx-manager-actions"><button class="itemx-tool ${loaded.lorebookEncounterEnabled ? 'itemx-setting-on' : ''}" data-action="lorebook-toggle">${loaded.lorebookEncounterEnabled ? '자동 ON' : '자동 OFF'}</button><button class="itemx-tool" data-action="lorebook-scan">지금 스캔</button></span></section><section class="itemx-setting-card"><span><strong>글자 크기</strong><small>인벤토리·스킬·조우 UI에 적용합니다.</small></span><select class="itemx-position-select" data-action="font-scale"><option value="small" ${loaded.fontScale === 'small' ? 'selected' : ''}>소</option><option value="medium" ${loaded.fontScale === 'medium' ? 'selected' : ''}>중</option><option value="large" ${loaded.fontScale === 'large' ? 'selected' : ''}>대</option></select></section><section class="itemx-setting-card"><span><strong>사이드 배지 위치</strong><small>기존 ITEMX 모듈과 같은 여섯 방향 배치입니다.</small></span><select class="itemx-position-select" data-action="badge-position">${positionOptions}</select></section><section class="itemx-setting-card"><span><strong>모델 처리 권한</strong><small>${permissionLabel} · 요청 주입과 원시 태그 정리에 필요합니다.</small></span><button class="itemx-tool" data-action="permissions">권한 요청</button></section><section class="itemx-setting-card"><span><strong>본문 카드 스타일</strong><small>${styleLabel} · 거부되어도 메시지별 스타일로 표시합니다.</small></span><button class="itemx-tool" data-action="style">다시 연결</button></section><section class="itemx-setting-card"><span><strong>채팅 저장소 재구축</strong><small>본문 사건과 수동 사건 원장을 시간순으로 다시 읽습니다.</small></span><button class="itemx-tool" data-action="rebuild">재구축</button></section><section class="itemx-setting-card"><span><strong>현재 채팅 ITEMX 기록 제거</strong><small>현재 봇을 OFF로 바꾸고 이 채팅 본문의 마커와 ITEMX/CODEX 원장을 삭제합니다.</small></span><button class="itemx-tool itemx-manager-danger" data-action="cleanup-chat">${cleanupArmed ? '다시 눌러 완전 제거' : '현재 채팅 정리'}</button></section>${debugContent}<p class="itemx-setting-note">보조 복구는 활성화된 도메인의 검증된 마커만 반영합니다.</p></div>`;
    const iframeSkills =
      ui.tab === 'skills'
        ? (loaded.codexSnapshot?.skills?.order || [])
            .map((id) => loaded.codexSnapshot.skills.entries[id])
            .filter(Boolean)
        : [];
    const iframeMonsters =
      ui.tab === 'bestiary'
        ? (loaded.codexSnapshot?.monsters?.order || [])
            .map((id) => loaded.codexSnapshot.monsters.entries[id])
            .filter(Boolean)
        : [];
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
    root.innerHTML = `<div class="risu-shell"><main class="stage itemx-plugin-stage ${runtime.compactContainer ? '' : 'itemx-plugin-stage-fallback'}"><section class="itemx-panel itemx2-font-${loaded.fontScale || 'small'} ${loaded.effectsEnabled ? '' : 'itemx2-effects-off'}" aria-label="ITEMX CODEX"><header class="itemx-ph"><span class="itemx-ph-text"><span class="itemx-ph-eyebrow">ITEMX CODEX · ${ITEMX_VERSION_LABEL}${updateLabelHtml()}</span><span class="itemx-ph-title">${ITEMXCore.esc(loaded.character.name || '인벤토리')}</span><span class="itemx-ph-sub">${enabled ? `보유 ${counts.owned} · 장착 ${counts.equipped} · 관찰 ${counts.observed}` : '현재 봇 비활성'} · ${ITEMXCore.esc(runtime.status)}</span></span><button class="itemx-ph-btn" data-action="close" aria-label="닫기">✕</button></header><nav class="itemx-main-tabs"><button class="itemx-main-tab ${ui.tab === 'inventory' ? 'itemx-main-tab-on' : ''}" data-tab="inventory">📦 인벤</button><button class="itemx-main-tab ${ui.tab === 'skills' ? 'itemx-main-tab-on' : ''}" data-tab="skills">✨ 스킬</button><button class="itemx-main-tab ${ui.tab === 'bestiary' ? 'itemx-main-tab-on' : ''}" data-tab="bestiary">⚔️ 조우</button><button class="itemx-main-tab ${ui.tab === 'settings' ? 'itemx-main-tab-on' : ''}" data-tab="settings">⚙️ 설정</button></nav>${content}</section></main></div>`;
    root.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      void closeInventory();
    });
    root.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      ui.selected = null;
      drawInventory(loaded);
    });
    root.querySelector('[data-action="back-skill"]')?.addEventListener('click', () => {
      ui.selectedSkill = null;
      drawInventory(loaded);
    });
    root.querySelector('[data-action="back-monster"]')?.addEventListener('click', () => {
      ui.selectedMonster = null;
      drawInventory(loaded);
    });
    root.querySelector('[data-action="motion"]')?.addEventListener('click', () => {
      ui.motion = !ui.motion;
      drawInventory(loaded);
    });
    root.querySelector('[data-action="repair-one"]')?.addEventListener('click', async () => {
      if (!selected) return;
      try {
        drawInventory(await repairOneItem(loaded, selected.id));
      } catch (error) {
        await notifyUser(error.message || String(error), 'error');
      }
    });
    root.querySelector('[data-action="toggle"]')?.addEventListener('click', async () => {
      loaded.enabled = !enabled;
      await setEnabled(loaded.character, loaded.enabled);
      runtime.status = loaded.enabled ? '현재 봇 활성화' : '현재 봇 비활성화';
      drawInventory(loaded);
    });
    for (const [domain, key, label] of [
      ['items', 'itemsEnabled', '무기·아이템'],
      ['skills', 'skillsEnabled', '스킬'],
      ['encounters', 'encountersEnabled', '전투 도감']
    ])
      root.querySelector(`[data-action="domain-${domain}"]`)?.addEventListener('click', async () => {
        loaded[key] = !loaded[key];
        await setDomainEnabled(loaded.character, domain, loaded[key]);
        runtime.status = `${label} · ${loaded[key] ? 'ON' : 'OFF'}`;
        drawInventory(loaded);
      });
    root.querySelector('[data-action="debug-toggle"]')?.addEventListener('click', async () => {
      loaded.debugEnabled = !loaded.debugEnabled;
      await setDebugEnabled(loaded.character, loaded.debugEnabled);
      runtime.status = `디버그 로그 · ${loaded.debugEnabled ? 'ON' : 'OFF'}`;
      drawInventory(loaded);
    });
    root.querySelector('[data-action="debug-clear"]')?.addEventListener('click', () => {
      runtime.debugEntries = [];
      runtime.status = '디버그 로그 비움';
      drawInventory(loaded);
    });
    root.querySelector('[data-action="main-output"]')?.addEventListener('click', async () => {
      loaded.mainOutput = !loaded.mainOutput;
      await setMainOutput(loaded.character, loaded.mainOutput);
      runtime.status = `메인 출력 · ${loaded.mainOutput ? 'ON' : 'OFF'}`;
      drawInventory(loaded);
    });
    root.querySelector('[data-action="aux-output"]')?.addEventListener('click', async () => {
      loaded.auxOutput = loaded.auxOutput === 'missing' ? 'always' : loaded.auxOutput === 'always' ? 'off' : 'missing';
      await setAuxOutput(loaded.character, loaded.auxOutput);
      runtime.status = `보조 출력 · ${AUX_LABELS[loaded.auxOutput]}`;
      drawInventory(loaded);
    });
    root.querySelector('[data-action="rarity-mode"]')?.addEventListener('click', async () => {
      loaded.rarityMode = loaded.rarityMode === 'itemx' ? 'world' : 'itemx';
      await setRarityMode(loaded.character, loaded.rarityMode);
      runtime.status = `등급 기준 · ${RARITY_MODE_LABELS[loaded.rarityMode]}`;
      drawInventory(loaded);
    });
    root.querySelector('[data-action="effects"]')?.addEventListener('click', async () => {
      loaded.effectsEnabled = !loaded.effectsEnabled;
      await setEffectsEnabled(loaded.character, loaded.effectsEnabled);
      runtime.status = `시각 이펙트 · ${loaded.effectsEnabled ? 'ON' : 'OFF'}`;
      drawInventory(loaded);
    });
    root.querySelector('[data-action="module-assets"]')?.addEventListener('click', async () => {
      if (loaded.moduleAssetsEnabled) {
        loaded.moduleAssetsEnabled = false;
        await setModuleAssetsEnabled(loaded.character, false);
        runtime.status = '모듈 에셋 초상화 · OFF';
        drawInventory(loaded);
        return;
      }
      const enabled = await enableModuleAssets(loaded.character, loaded.chat);
      loaded.moduleAssetsEnabled = enabled;
      runtime.status = enabled ? '모듈 에셋 초상화 · ON' : '모듈 에셋 권한 없음 · 이모지 폴백';
      if (!enabled)
        await notifyUser('모듈 에셋 권한이 허용되지 않았습니다. 조우 초상화는 이모지로 표시됩니다.', 'error');
      drawInventory(loaded);
    });
    root.querySelector('[data-action="lorebook-toggle"]')?.addEventListener('click', async () => {
      loaded.lorebookEncounterEnabled = !loaded.lorebookEncounterEnabled;
      await setLorebookEncounterEnabled(loaded.character, loaded.lorebookEncounterEnabled);
      runtime.status = `조우 로어북 자동 보완 · ${loaded.lorebookEncounterEnabled ? 'ON' : 'OFF'}`;
      if (loaded.lorebookEncounterEnabled) await scanLorebookEncounters({ refresh: true, silent: true });
      const next = await rebuildCurrent();
      if (next) {
        next.enabled = await isEnabled(next.character);
        drawInventory(next);
      } else drawInventory(loaded);
    });
    root.querySelector('[data-action="lorebook-scan"]')?.addEventListener('click', async () => {
      runtime.status = '조우 로어북 스캔 중';
      drawInventory(loaded);
      await scanLorebookEncounters({ refresh: true });
      const next = await rebuildCurrent();
      if (next) {
        next.enabled = await isEnabled(next.character);
        drawInventory(next);
      } else drawInventory(loaded);
    });
    root.querySelector('[data-action="font-scale"]')?.addEventListener('change', async (event) => {
      const value = event.target.value;
      await setFontScale(loaded.character, value);
      loaded.fontScale = value;
      runtime.status = `글자 크기 · ${{ small: '소', medium: '중', large: '대' }[value]}`;
      drawInventory(loaded);
    });
    root.querySelector('[data-action="rebuild"]')?.addEventListener('click', async () => {
      const next = await rebuildCurrent();
      if (next) {
        next.enabled = await isEnabled(next.character);
        drawInventory(next);
      }
    });
    root.querySelector('[data-action="cleanup-chat"]')?.addEventListener('click', async () => {
      if (runtime.cleanupArmedUntil <= Date.now()) {
        runtime.cleanupArmedUntil = Date.now() + 7000;
        runtime.status = '정리 확인 대기 · 7초 안에 다시 누르세요';
        drawInventory(loaded);
        return;
      }
      runtime.status = '현재 채팅 ITEMX 기록 정리 중';
      drawInventory(loaded);
      try {
        const result = await cleanCurrentChatItemx();
        if (result.loaded) drawInventory(result.loaded);
      } catch (error) {
        runtime.cleanupArmedUntil = 0;
        runtime.status = '현재 채팅 정리 실패';
        await notifyUser(`ITEMX CODEX 정리 실패: ${error.message || error}`, 'error');
        drawInventory(loaded);
      }
    });
    root.querySelector('[data-action="permissions"]')?.addEventListener('click', async () => {
      runtime.status = '모델 처리 권한 확인 중';
      drawInventory(loaded);
      const connected = await installPipelineHooks({ prompt: true });
      if (connected) await notifyUser('ITEMX CODEX 모델 처리 권한이 연결되었습니다.', 'success');
      else await notifyUser(`ITEMX CODEX 권한 연결 실패: ${runtime.lastHookError || runtime.status}`, 'error');
      const next = await rebuildCurrent();
      if (next) {
        next.enabled = await isEnabled(next.character);
        drawInventory(next);
      }
    });
    root.querySelector('[data-action="style"]')?.addEventListener('click', async () => {
      runtime.status = '본문 화면 연결 중';
      drawInventory(loaded);
      const styled = await installMainStyle({ prompt: true });
      if (styled) await notifyUser('ITEMX CODEX 본문 화면 연결이 완료되었습니다.', 'success');
      else await notifyUser(`ITEMX CODEX 화면 연결 실패: ${runtime.lastDomError || runtime.status}`, 'error');
      drawInventory(loaded);
    });
    root.querySelector('[data-action="badge-position"]')?.addEventListener('change', async (event) => {
      const value = event.target.value;
      if (!BADGE_POSITIONS.some(([key]) => key === value)) return;
      runtime.badgePosition = value;
      await Risuai.pluginStorage.setItem('badgePosition', value);
      if (runtime.rootDrawer) {
        for (const [other] of BADGE_POSITIONS) await runtime.rootDrawer.removeClass(`x-risu-itemx2-pos-${other}`);
        await runtime.rootDrawer.addClass(`x-risu-itemx2-pos-${value}`);
      }
      await installMainStyle();
      runtime.status = `배지 위치 · ${BADGE_POSITIONS.find(([key]) => key === value)?.[1] || value}`;
      drawInventory(loaded);
    });
    root.querySelector('[data-action="manage-select"]')?.addEventListener('change', (event) => {
      ui.manageId = event.target.value;
      drawInventory(loaded);
    });
    root.querySelector('[data-action="manage-remove"]')?.addEventListener('click', async () => {
      try {
        const target = itemsOf(loaded.snapshot).find((item) => item.id === ui.manageId);
        if (!target) throw new Error('대상 아이템이 없습니다.');
        if (!(await confirmUser(`${target.name}을(를) 현재 채팅 인벤토리에서 제거할까요?`))) return;
        runtime.status = '수동 제거 처리 중';
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
        runtime.status = '수동 제거 실패';
        await notifyUser(`ITEMX CODEX: ${error.message || error}`, 'error');
        drawInventory(loaded);
      }
    });
    root.querySelector('[data-action="manage-reroll"]')?.addEventListener('click', async () => {
      try {
        const target = itemsOf(loaded.snapshot).find((item) => item.id === ui.manageId);
        if (!target) throw new Error('대상 아이템이 없습니다.');
        const note = root.querySelector('[data-action="manage-note"]')?.value?.trim() || '';
        runtime.status = note ? '정보 수정 감정 중' : '아이템 재감정 중';
        drawInventory(loaded);
        const event = await runItemModel('reroll', loaded, target, note);
        const next = await commitManualEvents(loaded, [event], note ? '정보 수정' : '재감정');
        if (next) {
          next.enabled = await isEnabled(next.character);
          drawInventory(next);
        }
      } catch (error) {
        runtime.status = '재감정 실패';
        await notifyUser(`ITEMX CODEX: ${error.message || error}`, 'error');
        drawInventory(loaded);
      }
    });
    root.querySelector('[data-action="manage-create"]')?.addEventListener('click', async () => {
      try {
        const note = root.querySelector('[data-action="create-note"]')?.value?.trim() || '';
        if (!note) throw new Error('생성할 아이템 설명을 입력하세요.');
        runtime.status = '신규 아이템 생성 중';
        drawInventory(loaded);
        const event = await runItemModel('create', loaded, null, note);
        const next = await commitManualEvents(loaded, [event], '신규 생성');
        ui.manageId = event.item.id;
        if (next) {
          next.enabled = await isEnabled(next.character);
          drawInventory(next);
        }
      } catch (error) {
        runtime.status = '아이템 생성 실패';
        await notifyUser(`ITEMX CODEX: ${error.message || error}`, 'error');
        drawInventory(loaded);
      }
    });
    root.querySelectorAll('[data-tab]').forEach((el) =>
      el.addEventListener('click', () => {
        if (ui.tab === el.dataset.tab) return;
        ui.tab = el.dataset.tab;
        ui.selected = null;
        ui.selectedSkill = null;
        ui.selectedMonster = null;
        const current = root.querySelector('.itemx-main-tabs')?.nextElementSibling;
        if (current)
          current.innerHTML =
            '<div class="itemx2-tab-loading" role="status" aria-live="polite"><i></i><strong>탭 불러오는 중</strong><small>선택한 화면만 준비하고 있답니다.</small></div>';
        setTimeout(() => drawInventory(loaded), 24);
      })
    );
    root.querySelectorAll('[data-filter]').forEach((el) =>
      el.addEventListener('click', () => {
        ui.filter = el.dataset.filter;
        drawInventory(loaded);
      })
    );
    root.querySelectorAll('[data-item-id]').forEach((el) =>
      el.addEventListener('click', () => {
        ui.selected = el.dataset.itemId;
        drawInventory(loaded);
      })
    );
    root.querySelectorAll('[data-skill-id]').forEach((el) =>
      el.addEventListener('click', () => {
        ui.selectedSkill = el.dataset.skillId;
        drawInventory(loaded);
      })
    );
    root.querySelectorAll('[data-monster-id]').forEach((el) =>
      el.addEventListener('click', () => {
        ui.selectedMonster = el.dataset.monsterId;
        drawInventory(loaded);
      })
    );
    root.querySelector('.itemx-search-input')?.addEventListener('input', (event) => {
      ui.query = event.target.value;
      drawInventory(loaded);
      const input = root.querySelector('.itemx-search-input');
      input?.focus();
      input?.setSelectionRange(ui.query.length, ui.query.length);
    });
  }

  function reducedMotion() {
    return (
      typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
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
    invalidateHostSettingsVisibility();
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
      if (panel && transition === runtime.panelTransition && runtime.panelOpen && !reducedMotion())
        panel.classList.add('itemx-plugin-panel-in');
    } catch (error) {
      if (transition === runtime.panelTransition) runtime.panelOpen = false;
      runtime.status = '인벤토리 열기 오류';
      try {
        await Risuai.hideContainer();
      } catch {}
      fail('openInventory', error);
    }
  }

  async function toggleCurrentBot() {
    const ctx = await context();
    if (!ctx) return;
    const next = !(await isEnabled(ctx.character));
    await setEnabled(ctx.character, next);
    runtime.status = next ? '현재 봇 활성화' : '현재 봇 비활성화';
    await openRootInventory({ open: true, tab: 'settings' });
  }

  async function openSettingsFromRisuMenu() {
    const active = await context();
    if (!active) {
      runtime.allowDrawerOverSettings = false;
      invalidateHostSettingsVisibility();
      runtime.status = '채팅 진입 대기';
      const message = 'ITEMX CODEX는 채팅봇에 진입한 뒤 사용할 수 있습니다.';
      await notifyUser(message, 'error');
      return;
    }
    runtime.activeContextKey = active.key;
    runtime.allowDrawerOverSettings = true;
    invalidateHostSettingsVisibility();
    let styled = Boolean(runtime.mainDoc) || (await installMainStyle());
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
    if (!runtime.hooks.process) {
      await Risuai.addRisuScriptHandler('process', processHandler);
      runtime.hooks.process = true;
    }
    if (!runtime.hooks.output) {
      await Risuai.addRisuScriptHandler('output', outputFallback);
      runtime.hooks.output = true;
    }
    if (!runtime.hooks.display) {
      await Risuai.addRisuScriptHandler('display', displayHandler);
      runtime.hooks.display = true;
    }
  }

  async function installPipelineHooksNow({ prompt = false } = {}) {
    try {
      await installDisplayHooks();
      const permission =
        typeof Risuai.requestPluginPermission === 'function' ? await Risuai.requestPluginPermission('replacer') : true;
      runtime.permissions.replacer = permission === true;
      if (!runtime.permissions.replacer) {
        if (runtime.hooks.before) {
          try {
            await Risuai.removeRisuReplacer('beforeRequest', beforeRequest);
          } catch {}
        }
        if (runtime.hooks.after) {
          try {
            await Risuai.removeRisuReplacer('afterRequest', afterRequest);
          } catch {}
        }
        runtime.hooks.before = false;
        runtime.hooks.after = false;
        runtime.lastHookError = '모델 처리 권한이 허용되지 않았습니다';
        runtime.status = '모델 처리 권한 필요';
      } else {
        if (!runtime.hooks.before) {
          await Risuai.addRisuReplacer('beforeRequest', beforeRequest);
          runtime.hooks.before = true;
        }
        if (!runtime.hooks.after) {
          await Risuai.addRisuReplacer('afterRequest', afterRequest);
          runtime.hooks.after = true;
        }
      }
      if (!runtime.hooks.listener) {
        if (typeof Risuai.addRisuChatListener !== 'function') {
          runtime.hooks.listener = 'unsupported';
          log('chat listener unavailable; continuing with core request/output hooks');
        } else
          try {
            await Risuai.addRisuChatListener('output', (output) => {
              const loaded = runtime.cachedLoaded;
              if (
                output?.chat &&
                loaded?.key === runtime.activeContextKey &&
                output.characterIndex === loaded.characterIndex &&
                output.chatIndex === loaded.chatIndex
              )
                commitEventBursts(output.chat);
              void scheduleCommittedOutputSync();
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
      if (runtime.catchUpTimer) armCatchUpWatchdog();
      return runtime.permissions.replacer;
    } catch (error) {
      runtime.permissions.replacer = false;
      runtime.lastHookError = String(error?.message || error || '알 수 없는 모델 훅 오류');
      runtime.status = '모델 연결 오류';
      fail('pipeline hooks', error);
      return false;
    }
  }

  function armRemountWatchdog() {
    if (runtime.unloading) return;
    const interval = runtime.hostObserver || !runtime.activeContextKey ? 10000 : 1200;
    if (runtime.remountTimer && runtime.remountInterval === interval) return;
    if (runtime.remountTimer) globalThis.clearInterval(runtime.remountTimer);
    runtime.remountInterval = interval;
    runtime.remountTimer = globalThis.setInterval(() => {
      if (!runtime.bodyFxScrollActive) {
        const now = Date.now();
        if (!runtime.activeContextKey) {
          runtime.homeProbeAt = now;
          void ensureRootInventory();
        } else if (!runtime.hostObserver || now - runtime.remountFallbackAt >= 10000) {
          void ensureRootInventory();
        }
      }
    }, interval);
  }

  try {
    await loadBadgePosition();
    const setting = await Risuai.registerSetting(
      'ITEMX CODEX · 권한 및 설정',
      openSettingsFromRisuMenu,
      '💎',
      'html',
      'itemx2-current-bot'
    );
    if (setting?.id) runtime.uiParts.push(setting.id);
    await installDisplayHooks();
    const initial = await context();
    let connected = false,
      styled = false;
    if (initial) {
      runtime.activeContextKey = initial.key;
      runtime.status = '초기 화면 연결 중';
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
      void checkForUpdate();
    } else {
      runtime.status = '채팅 진입 대기';
    }
    armRemountWatchdog();
    armCatchUpWatchdog();
    runtime.updateTimer = globalThis.setInterval(() => {
      void checkForUpdate();
    }, ITEMX_UPDATE_CHECK_MS);
    if (initial) void catchUpLatestOutput().catch((error) => fail('initial output catch-up', error));
    if (connected && styled) runtime.status = '정상';
    log(`v${ITEMX_PLUGIN_VERSION} ready`);
  } catch (error) {
    runtime.status = '초기화 오류';
    await removeRootDrawer();
    await notifyUser(`ITEMX CODEX 초기화 실패: ${error.message || error}`, 'error');
    fail('bootstrap', error);
  }

  await Risuai.onUnload(async () => {
    runtime.unloading = true;
    clearEventBursts();
    runtime.panelOpen = false;
    runtime.panelTransition += 1;
    if (runtime.remountTimer) globalThis.clearInterval(runtime.remountTimer);
    runtime.remountTimer = null;
    runtime.remountInterval = 0;
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
      try {
        await runtime.bodyFxClassOwner.removeClass('x-risu-itemx-body-scrolling');
      } catch {}
    }
    runtime.bodyFxScrollActive = false;
    runtime.bodyFxSawScroll = false;
    runtime.outputSyncDeferred = false;
    runtime.hostSyncDeferred = false;
    try {
      await Risuai.hideContainer();
    } catch {}
    await removeRootDrawer();
    await removeBodyEffectGovernor();
    try {
      if (runtime.hostObserver?.disconnect) await runtime.hostObserver.disconnect();
    } catch {}
    runtime.hostObserver = null;
    try {
      await Risuai.removeRisuScriptHandler('output', outputFallback);
    } catch {}
    try {
      await Risuai.removeRisuScriptHandler('display', displayHandler);
    } catch {}
    try {
      await Risuai.removeRisuScriptHandler('process', processHandler);
    } catch {}
    try {
      await Risuai.removeRisuReplacer('beforeRequest', beforeRequest);
    } catch {}
    try {
      await Risuai.removeRisuReplacer('afterRequest', afterRequest);
    } catch {}
    for (const id of runtime.uiParts) {
      try {
        await Risuai.unregisterUIPart(id);
      } catch {}
    }
    try {
      if (runtime.mainStyle) await runtime.mainStyle.remove();
    } catch {}
  });
})();
