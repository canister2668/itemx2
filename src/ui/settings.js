/* ITEMX ui settings owner. Concatenated inside the runtime closure. */
import * as Backup from '../engine/backup.js';
import * as Core from '../engine/core.js';
import { auxActive, auxRunning, cancelAux, recoverAuxiliaryOutput } from '../aux.js';
import { context } from '../chat-io.js';
import { ITEMX_PLUGIN_VERSION } from '../config.js';
import { lastError, rememberUiPart, updateState } from '../connection.js';
import { installPipelineHooks } from '../hooks.js';
import { host } from '../host.js';
import { t } from '../i18n.js';
import { clearDebugLog, debugLog, delay, entry, fail, workQueue } from '../kernel.js';
import {
  cachedOrRebuildCurrent,
  cleanCurrentChatItemx,
  commitBackupImport,
  compactCurrentChatStorage,
  exportCurrentBackup,
  itemxStorageFootprint,
  prepareBackupImport,
  rebuildCurrent,
  removeOldMarkersCurrent
} from '../ledger.js';
import { scanLorebookEncounters } from '../lore-sync.js';
import { enableModuleAssets } from '../portraits.js';
import { invalidateLoaded, setActiveContextKey } from '../session.js';
import {
  DOMAIN_KEYS,
  FX_MODES,
  SKIN_MODES,
  badgePositionSetting,
  cachedSettings,
  changeSettings,
  isEnabled,
  setBadgePosition,
  settingsFor
} from '../settings.js';
import { setStatus, status } from '../status.js';
import {
  auxStatusText,
  updateConnectionUi,
  updateRootDomainCard,
  updateRootSegment,
  updateRootSwitch
} from './controls.js';
import {
  hostSettingsCard,
  invalidateHostSettingsVisibility,
  mountRootLoading,
  notifyUser,
  openInventory,
  openRootInventory,
  patchDebugPanel,
  patchRootHeader,
  queryMainClass,
  settingsLoaded,
  showRootFeedback,
  updateRootLoading
} from './panel.js';
import { BADGE_POSITIONS, SKIN_LABELS, installMainStyle, mainDoc } from './style.js';
import { uiState } from './view-state.js';

export async function syncUpdateIndicator() {
  if (!mainDoc() || !uiState.rootDrawer) return;
  try {
    const current = await mainDoc().querySelector('.x-risu-itemx2-update-indicator');
    const currentLabel = await mainDoc().querySelector('.x-risu-itemx2-update-label');
    if (!updateState().available) {
      if (current) await current.remove();
      if (currentLabel) await currentLabel.remove();
      return;
    }
    if (current) {
      await current.setAttribute('x-itemx2-update', updateState().latest);
    } else {
      const badge = await mainDoc().querySelector('.x-risu-itemx2-native-badge');
      if (badge) {
        const indicator = await mainDoc().createElement('span');
        await indicator.setClassName('x-risu-itemx2-update-indicator');
        await indicator.setAttribute('x-itemx2-update', updateState().latest);
        await indicator.setTextContent('↑');
        await badge.appendChild(indicator);
      }
    }
    if (!currentLabel) {
      const eyebrow = await mainDoc().querySelector('.x-risu-itemx-ph-eyebrow');
      if (eyebrow) {
        const label = await mainDoc().createElement('span');
        await label.setClassName('x-risu-itemx2-update-label');
        await label.setAttribute('x-itemx2-update', updateState().latest);
        await label.setTextContent('UPDATE');
        await eyebrow.appendChild(label);
      }
    }
  } catch (error) {
    fail('update indicator', error);
  }
}

export const POWER_BUTTON_ID = 'itemx2-power-toggle';
export const powerIcon = (on) =>
  `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><rect x="1" y="5" width="18" height="10" rx="5" fill="${on ? '#2f9e62' : '#4b5363'}"/><circle cx="${on ? 14 : 6}" cy="10" r="3.6" fill="${on ? '#ffffff' : '#c3c9d3'}"/></svg>`;

// The chat-menu switch is the way back once the side badge is hidden for an off bot.
export async function syncPowerUi(enabled) {
  const on = Boolean(enabled);
  if (uiState.powerButtonState !== on) {
    try {
      const part = await host().registerButton(
        {
          name: on ? t('ui-settings.power-on') : t('ui-settings.power-off'),
          icon: powerIcon(on),
          iconType: 'html',
          location: 'chat',
          id: POWER_BUTTON_ID
        },
        entry('power-toggle', togglePowerFromChatMenu)
      );
      if (part?.id) rememberUiPart(part.id);
      uiState.powerButtonState = on;
    } catch (error) {
      fail('chat menu power button', error);
    }
  }
  if (!uiState.rootDrawer) return;
  try {
    if (on) await uiState.rootDrawer.removeClass('x-risu-itemx2-bot-off');
    else await uiState.rootDrawer.addClass('x-risu-itemx2-bot-off');
  } catch {}
}

export async function togglePowerFromChatMenu() {
  const ctx = await context();
  if (!ctx) {
    await notifyUser(t('ui-settings.008'), 'error');
    return;
  }
  const next = !(await isEnabled(ctx.character));
  await changeSettings(ctx.character, { enabled: Boolean(next) });
  setStatus(next ? t('ui-settings.011') : t('ui-settings.010'));
  await notifyUser(next ? t('ui-settings.power-toast-on') : t('ui-settings.power-toast-off'), 'success');
  if (uiState.rootOpen) await openRootInventory({ open: true, tab: uiState.activeRootTab || 'settings' });
}

export const FX_LABELS = {
  full: t('ui-settings.fx-full'),
  lite: t('ui-settings.fx-lite'),
  off: t('ui-settings.147')
};
export const AUX_LABELS = { off: t('ui-settings.147'), missing: t('ui-settings.146'), always: t('ui-settings.145') };

export const RARITY_MODE_LABELS = { world: t('ui-settings.144'), itemx: t('ui-settings.143') };

export function backupSettingsHtml() {
  return setCard(
    t('ui-settings.142'),
    t('ui-settings.141'),
    `<button class="itemx2-root-setting-button itemx2-setting-backup" type="button">${t('ui-settings.140.1')}</button>`
  );
}

export async function openBackupPanel() {
  if (uiState.backupOpen) return;
  const ctx = await context();
  if (!ctx) throw new Error(t('ui-settings.139'));
  uiState.backupOpen = true;
  let preview = null,
    url = '',
    busy = false;
  document.body.innerHTML = `<main id="itemx-backup"><header><h2>${t('ui-settings.142')}</h2><button id="ix-close" type="button">${t('ui-settings.138.2')}</button></header><p id="ix-target"></p><p>${t('ui-settings.138.3')}</p><section><h3>${t('ui-settings.138.4')}</h3><button id="ix-export" type="button">${t('ui-settings.138.5')}</button><a id="ix-download" hidden>${t('ui-settings.138.6')}</a><button id="ix-copy" type="button" disabled>${t('ui-settings.138.7')}</button><textarea id="ix-export-text" aria-label="${t('ui-settings.138.8')}" readonly placeholder="${t('ui-settings.138.9')}"></textarea></section><section><h3>${t('ui-settings.138.10')}</h3><label>${t('ui-settings.138.11')} <select id="ix-mode"><option value="empty">${t('ui-settings.138.12')}</option><option value="replace">${t('ui-settings.138.13')}</option></select></label><p>${t('ui-settings.138.14')}</p><label>${t('ui-settings.138.15')} <input id="ix-file" type="file" accept=".json,application/json"></label><textarea id="ix-import-text" aria-label="${t('ui-settings.138.16')}" placeholder="${t('ui-settings.138.17')}"></textarea><button id="ix-preview" type="button">${t('ui-settings.138.18')}</button><p id="ix-preview-text"></p><button id="ix-import" type="button" disabled>${t('ui-settings.125')}</button></section><p id="ix-status" role="status" aria-live="polite"></p></main>`;
  // Reopening reuses its sheet instead of stacking another copy in the head.
  const style = document.getElementById('itemx-backup-style') || document.createElement('style');
  style.id = 'itemx-backup-style';
  style.textContent =
    'body{margin:0;background:#0c121c;color:#e4eaf4;font:15px/1.6 system-ui}#itemx-backup{max-width:680px;margin:auto;padding:20px;box-sizing:border-box}#itemx-backup header{display:flex;align-items:center;justify-content:space-between;gap:12px}#itemx-backup section{padding:16px;margin:16px 0;border:1px solid #33435d;border-radius:12px}#itemx-backup button,#itemx-backup a{display:inline-block;padding:10px;margin:4px;border:1px solid #536884;border-radius:8px;background:#1a2940;color:#eef3fc;font:inherit;cursor:pointer}#itemx-backup [hidden]{display:none}#itemx-backup button:disabled{opacity:.45;cursor:default}#itemx-backup textarea{display:block;box-sizing:border-box;width:100%;min-height:105px;margin:12px 0;padding:10px;background:#090e17;color:#d9e6fc;border:1px solid #40516c;border-radius:8px}#itemx-backup input,#itemx-backup select{max-width:100%}#itemx-backup select{padding:8px;background:#1a2940;color:#eef3fc;border:1px solid #536884;border-radius:8px}#itemx-backup p{overflow-wrap:anywhere}#ix-status{padding:10px;background:#142137}';
  if (!style.isConnected) document.head.appendChild(style);
  const get = (id) => document.getElementById(id);
  get('ix-target').textContent = t(
    'ui-settings.135',
    ctx.character.name || t('ui-settings.136'),
    ctx.chat.name || t('ui-settings.137')
  );
  const status = (text) => {
    get('ix-status').textContent = text;
  };
  const countText = (value) => {
    const [i, s, m] = Backup.counts(value);
    return t('ui-settings.134', i, s, m);
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
        await host().hideContainer();
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
        status(t('ui-settings.133', countText(value)));
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
          status(t('ui-settings.132'));
        } catch {
          status(t('ui-settings.131'));
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
      if (file.size > Backup.MAX_BYTES) throw new Error(t('ui-settings.130'));
      get('ix-import-text').value = await file.text();
      status(t('ui-settings.129'));
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
          throw new Error(t('ui-settings.128'));
        preview = prepared;
        get('ix-preview-text').textContent =
          `${preview.value.source} · ${preview.value.createdAt} · ${countText(preview.value)}${mode === 'replace' ? t('ui-settings.127', preview.previousCounts[0], preview.previousCounts[1], preview.previousCounts[2]) : ''}`;
        get('ix-import').textContent = mode === 'replace' ? t('ui-settings.126') : t('ui-settings.125');
        get('ix-import').disabled = false;
        status(t('ui-settings.124'));
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
        status(t('ui-settings.123', countText(value)));
      }),
    true
  );
  try {
    await host().showContainer('fullscreen');
  } catch (error) {
    uiState.backupOpen = false;
    style.remove();
    throw error;
  }
}

export const NATIVE_ACTION_ALIASES = {
  'main-output': 'main',
  'lorebook-toggle': 'lorebook',
  'cleanup-chat': 'cleanup'
};

export const SETTINGS_SKINS = {
  native: {
    hook: (action) => ` itemx2-setting-${NATIVE_ACTION_ALIASES[action] || action}`,
    data: () => '',
    segHook: (group, value) => ` itemx2-seg-${group}-${value}`,
    segData: () => '',
    choiceData: () => ''
  }
};

export const setCardInner = (title, note, control = '', extra = '') =>
  `<span><strong>${title}</strong><small${extra}>${note}</small></span>${control}`;
export const setCard = (...args) => `<section class="itemx2-root-setting-card">${setCardInner(...args)}</section>`;

export const setButton = (skin, action, label, extra = '') =>
  `<button class="itemx2-root-setting-button${skin.hook(action)}${extra}" type="button"${skin.data(action)}>${label}</button>`;

// Destructive actions ask with explicit yes / no buttons instead of a timed second tap.
export const confirmRow = (skin, question, yesAction, yesLabel, noAction) =>
  `<span class="itemx2-confirm-row"><small>${question}</small><span class="itemx2-manager-actions">${setButton(skin, yesAction, yesLabel, ' itemx2-setting-danger')}${setButton(skin, noAction, t('ui-settings.confirm-no'))}</span></span>`;

export const setSwitch = (skin, action, on) =>
  `<button class="itemx2-root-setting-button itemx2-sw${skin.hook(action)}${on ? ' itemx2-setting-on' : ''}" type="button" role="switch" aria-checked="${on ? 'true' : 'false'}"${skin.data(action)}><i></i></button>`;

export const setSegment = (skin, group, entries, current) =>
  `<div class="itemx2-seg">${entries
    .map(
      ([value, label]) =>
        `<button class="itemx2-seg-btn${skin.segHook(group, value)}${current === value ? ' itemx2-seg-on' : ''}" type="button"${skin.segData(group, value)}>${label}</button>`
    )
    .join('')}</div>`;

// The cards whose controls swap for a yes / no row. Each renders on its own so
// arming or disarming patches that one card in place (the tab keeps its scroll).
export function confirmCards(skin, parts) {
  return {
    'itemx2-setting-storage-cleanup': [
      t('ui-settings.106'),
      t('ui-settings.105', parts.footprintLabel),
      parts.storageCleanupArmed
        ? confirmRow(
            skin,
            t('ui-settings.confirm-storage'),
            'storage-cleanup',
            t('ui-settings.confirm-yes-storage'),
            'storage-cleanup-cancel'
          )
        : `<span class="itemx2-manager-actions">${setButton(skin, 'rebuild', t('ui-settings.104'))}${setButton(skin, 'storage-cleanup', t('ui-settings.102'))}</span>`
    ],
    'itemx2-setting-old-markers': parts.oldMarkerCount
      ? [
          t('ui-settings.old-markers-title'),
          t('ui-settings.old-markers-note', parts.oldMarkerCount),
          parts.oldMarkersArmed
            ? confirmRow(
                skin,
                t('ui-settings.confirm-old-markers'),
                'old-markers',
                t('ui-settings.confirm-yes-old-markers'),
                'old-markers-cancel'
              )
            : setButton(skin, 'old-markers', t('ui-settings.old-markers-button'))
        ]
      : null,
    'itemx2-setting-cleanup': [
      t('ui-settings.110'),
      t('ui-settings.109'),
      parts.cleanupArmed
        ? confirmRow(
            skin,
            t('ui-settings.confirm-cleanup'),
            'cleanup-chat',
            t('ui-settings.confirm-yes-cleanup'),
            'cleanup-cancel'
          )
        : setButton(skin, 'cleanup-chat', t('ui-settings.107'))
    ]
  };
}
const confirmCard = (cards, hook) => (cards[hook] ? setCard(...cards[hook]) : '');

// Re-renders one confirm card of the open drawer in place.
export async function patchSettingsCard(hook) {
  const loaded = await settingsLoaded();
  if (!loaded) return false;
  const args = confirmCards(SETTINGS_SKINS.native, settingsStorageParts(loaded))[hook];
  const card = args ? await hostSettingsCard(hook) : null;
  if (!card) return openRootInventory({ open: true, tab: 'settings', loaded });
  await card.setInnerHTML(setCardInner(...args));
  await patchRootHeader(loaded);
  return true;
}

export function settingsPanelHtml(loaded, skin, parts) {
  const cards = confirmCards(skin, parts);
  const connection = parts.connection;
  const connectionCards = setCard(
    t('ui-settings.122'),
    t('ui-settings.121'),
    setButton(
      skin,
      'connect',
      workQueue.isActive('connect')
        ? t('ui-settings.120')
        : connection.ready
          ? t('ui-settings.119')
          : t('ui-settings.118'),
      ` itemx2-root-setting-button-primary${workQueue.isActive('connect') ? ' itemx2-root-setting-button-busy' : ''}`
    )
  ).replace('</small>', `</small><span class="itemx2-status-row">${parts.chips}</span>`);
  return `<div class="itemx2-root-settings"><h4 class="itemx2-set-group">${t('ui-settings.074.1')}</h4>${connectionCards}${setCard(
    t('ui-settings.077'),
    Core.esc(auxStatusText()),
    `<button class="itemx2-root-setting-button${skin.hook('aux-run')}" type="button"${skin.data('aux-run')}>${auxRunning() ? t('ui-settings.aux-cancel') : t('ui-settings.075')}</button>`,
    ' class="itemx2-aux-setting-status"'
  )}<h4 class="itemx2-set-group">${t('ui-panel.058.1')}</h4>${setCard(
    t('ui-settings.079'),
    t('ui-settings.078')
  )}<div class="itemx2-domain-grid">${parts.domainControls}</div>${setCard(
    t('ui-settings.084'),
    t('ui-settings.083'),
    setSwitch(skin, 'main-output', loaded.mainOutput)
  )}${setCard(
    t('ui-settings.086'),
    `${t('ui-settings.085.1')} <b>${t('ui-settings.085.2')}</b>${t('ui-settings.085.3')}`,
    setSegment(skin, 'aux', Object.entries(AUX_LABELS), loaded.auxOutput)
  )}${setCard(
    t('ui-settings.088'),
    t('ui-settings.087'),
    setSegment(skin, 'rarity', Object.entries(RARITY_MODE_LABELS), loaded.rarityMode)
  )}${setCard(
    t('ui-settings.091'),
    t('ui-settings.090'),
    `<span class="itemx2-manager-actions">${setSwitch(skin, 'lorebook-toggle', loaded.lorebookEncounterEnabled)}${setButton(skin, 'lorebook-scan', t('ui-settings.089'))}</span>`
  )}${setCard(
    t('ui-settings.093'),
    t('ui-settings.092'),
    setSwitch(skin, 'module-assets', loaded.moduleAssetsEnabled)
  )}<h4 class="itemx2-set-group">${t('ui-settings.074.3')}</h4>${setCard(
    t('ui-settings.095'),
    t('ui-settings.094'),
    setSegment(
      skin,
      'skin',
      SKIN_MODES.map((mode) => [mode, SKIN_LABELS[mode]]),
      loaded.skin || 'dark'
    )
  )}${setCard(
    t('ui-settings.fx-title'),
    t('ui-settings.fx-note'),
    setSegment(skin, 'fx', Object.entries(FX_LABELS), loaded.effectsLevel)
  )}${setCard(t('ui-settings.099'), t('ui-settings.098'))}<div class="itemx2-font-grid">${parts.fontChoices}</div>${setCard(
    t('ui-settings.101'),
    t('ui-settings.100')
  )}<div class="itemx2-position-grid">${parts.positionChoices}</div>${parts.manager}<h4 class="itemx2-set-group">${t('ui-settings.074.4')}</h4>${backupSettingsHtml()}${confirmCard(cards, 'itemx2-setting-storage-cleanup')}${confirmCard(cards, 'itemx2-setting-old-markers')}<div class="itemx2-danger-zone"><h4>${t('ui-settings.074.5')}</h4>${confirmCard(cards, 'itemx2-setting-cleanup')}</div>${parts.debugPanel}${setCard(t('ui-settings.111'), `ITEMX ${ITEMX_PLUGIN_VERSION}`)}</div>`;
}

export function settingsDomainControls(loaded, skin) {
  return [
    ['items', t('ui-settings.046'), loaded.itemsEnabled, t('ui-settings.072')],
    ['skills', t('ui-settings.045'), loaded.skillsEnabled, t('ui-settings.070')],
    ['encounters', t('ui-settings.044'), loaded.encountersEnabled, t('ui-settings.068')]
  ]
    .map(
      ([key, label, value, note]) =>
        `<button class="itemx2-domain-card${skin.hook(`domain-${key}`)} ${value ? 'itemx2-setting-on' : ''}" type="button"${skin.data(`domain-${key}`)}><strong>${label}</strong><small>${note}</small><i>${value ? t('ui-settings.067') : t('ui-settings.066')}</i></button>`
    )
    .join('');
}

export function settingsFontChoices(loaded, skin) {
  return [
    ['small', t('ui-settings.065')],
    ['medium', t('ui-settings.064')],
    ['large', t('ui-settings.063')]
  ]
    .map(
      ([value, label]) =>
        `<button class="itemx2-font-choice itemx2-setting-font-${value} ${loaded.fontScale === value ? 'itemx2-font-on' : ''}" type="button"${skin.choiceData('font', value)}><em>${t('ui-settings.062.1')}</em><span>${label}</span></button>`
    )
    .join('');
}

export function settingsPositionChoices(skin) {
  const positionLabel = (BADGE_POSITIONS.find(([key]) => key === badgePositionSetting()) || BADGE_POSITIONS[0])[1];
  // A map of the screen beats six abbreviations: the slot sits where the badge will.
  return `<div class="itemx2-position-map">${BADGE_POSITIONS.map(
    ([key, label]) =>
      `<button class="itemx2-position-choice itemx2-position-${key} ${badgePositionSetting() === key ? 'itemx2-position-on' : ''}" type="button"${skin.choiceData('position', key)} aria-label="${label}"></button>`
  ).join(
    ''
  )}<span class="itemx2-position-screen">${t('ui-settings.061.1')}</span></div><p class="itemx2-position-hint">${t('ui-settings.061.2')} <b>${positionLabel}</b> ${t('ui-settings.061.3')}</p>`;
}

export function settingsStorageParts(loaded) {
  const footprint = itemxStorageFootprint(loaded.chat);
  return {
    cleanupArmed: uiState.cleanupArmed,
    storageCleanupArmed: uiState.storageCleanupArmed,
    oldMarkersArmed: uiState.oldMarkersArmed,
    oldMarkerCount: footprint.oldMarkerCount,
    footprintLabel: t('ui-settings.060', Math.max(1, Math.ceil(footprint.totalBytes / 1024)), footprint.anchorCount)
  };
}

export function settingsDebugLog() {
  return (
    debugLog()
      .slice(-12)
      .reverse()
      .map(
        (entry) =>
          `${new Date(entry.at).toLocaleTimeString('ko-KR', { hour12: false })} ${entry.where}\n${entry.detail}`
      )
      .join('\n\n') || t('ui-settings.059')
  );
}

export function rootSettingActions() {
  // First tap swaps the button for a yes / no row; only "yes" runs the action.
  const armed = (key, hook, arm, confirmed) => async () => {
    if (!uiState[key]) {
      uiState[key] = 1;
      await arm();
      await patchSettingsCard(hook);
      return;
    }
    uiState[key] = 0;
    await confirmed();
  };
  const disarm = (key, hook) => async () => {
    uiState[key] = 0;
    await patchSettingsCard(hook);
  };
  return [
    {
      hook: 'itemx2-setting-connect',
      run: async () => {
        const restoreStage = workQueue.stage('connect');
        setStatus(t('ui-settings.058'));
        await updateConnectionUi();
        await showRootFeedback(t('ui-settings.057'), 'working', 0);
        try {
          const connected = await installPipelineHooks({ prompt: true });
          const styled = await installMainStyle();
          setStatus(
            connected && styled ? t('ui-settings.003') : connected ? t('ui-settings.002') : t('ui-settings.001')
          );
          if (connected && styled) {
            await showRootFeedback(t('ui-settings.053'), 'success');
          } else {
            await showRootFeedback(
              t('ui-settings.052', (!connected ? lastError('hook') : lastError('dom')) || status()),
              'error',
              3600
            );
          }
          if (!connected || !styled)
            await notifyUser(
              t('ui-settings.051', (!connected ? lastError('hook') : lastError('dom')) || status()),
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
        // While a pass runs, the same button cancels it.
        if (auxRunning()) {
          await cancelAux();
          return;
        }
        if (auxActive() > 0) {
          setStatus(t('ui-settings.aux-cancel-pending'));
          return;
        }
        setStatus(t('ui-settings.050'));
        await recoverAuxiliaryOutput({ force: true });
      }
    },
    ...BADGE_POSITIONS.map(([key, label]) => ({
      hook: `itemx2-position-${key}`,
      run: async () => {
        await setBadgePosition(key);
        setStatus(t('ui-settings.049', label));
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
      run: async () => {
        const loaded = await rebuildCurrent();
        if (!loaded) return;
        const next = !(await isEnabled(loaded.character));
        await changeSettings(loaded.character, { enabled: Boolean(next) });
        setStatus(next ? t('ui-settings.011') : t('ui-settings.010'));
        await updateRootSwitch('.x-risu-itemx2-setting-toggle', next, 'x-risu-itemx2-power-on');
      }
    },
    ...[
      ['items', 'itemsEnabled', t('ui-settings.046')],
      ['skills', 'skillsEnabled', t('ui-settings.045')],
      ['encounters', 'encountersEnabled', t('ui-settings.044')]
    ].map(([domain, key, label]) => ({
      hook: `itemx2-setting-domain-${domain}`,
      run: async () => {
        const loaded = await rebuildCurrent();
        if (!loaded) return;
        const current = await settingsFor(loaded.character),
          value = !current[key];
        await changeSettings(loaded.character, { [DOMAIN_KEYS[domain]]: Boolean(value) });
        invalidateLoaded();
        setStatus(`${label} · ${value ? 'ON' : 'OFF'}`);
        await updateRootDomainCard(
          `.x-risu-itemx2-setting-domain-${domain}`,
          value,
          value ? t('ui-settings.067') : t('ui-settings.066')
        );
      }
    })),
    {
      hook: 'itemx2-setting-debug',
      run: async () => {
        const loaded = await rebuildCurrent();
        if (!loaded) return;
        const value = !(await settingsFor(loaded.character)).debugEnabled;
        await changeSettings(loaded.character, { debugEnabled: value });
        setStatus(t('ui-settings.043', value ? 'ON' : 'OFF'));
        await patchDebugPanel();
      }
    },
    {
      hook: 'itemx2-setting-debug-clear',
      run: async () => {
        clearDebugLog();
        setStatus(t('ui-settings.042'));
        await patchDebugPanel();
      }
    },
    {
      hook: 'itemx2-setting-main',
      run: async () => {
        const loaded = await rebuildCurrent();
        if (!loaded) return;
        const value = !(await settingsFor(loaded.character)).mainOutput;
        await changeSettings(loaded.character, { mainOutput: value });
        setStatus(t('ui-settings.041', value ? 'ON' : 'OFF'));
        await updateRootSwitch('.x-risu-itemx2-setting-main', value);
      }
    },
    // Multi-choice settings render every option, so one row per option.
    ...[
      [
        'aux',
        Object.keys(AUX_LABELS),
        async (loaded, value) => {
          await changeSettings(loaded.character, { auxOutput: value });
          setStatus(t('ui-settings.040', AUX_LABELS[value]));
        }
      ],
      [
        'rarity',
        Object.keys(RARITY_MODE_LABELS),
        async (loaded, value) => {
          await changeSettings(loaded.character, { rarityMode: value });
          setStatus(t('ui-settings.039', RARITY_MODE_LABELS[value]));
        }
      ],
      [
        'fx',
        FX_MODES,
        async (loaded, value) => {
          await changeSettings(loaded.character, { effectsLevel: value });
          loaded.effectsLevel = value;
          setStatus(t('ui-settings.fx-status', FX_LABELS[value]));
        }
      ],
      [
        'skin',
        SKIN_MODES,
        async (loaded, value) => {
          await changeSettings(loaded.character, { skin: value });
          loaded.skin = value;
          setStatus(t('ui-settings.038', SKIN_LABELS[value]));
        }
      ]
    ].flatMap(([group, values, apply]) =>
      values.map((value) => ({
        hook: `itemx2-seg-${group}-${value}`,
        run: async () => {
          const loaded = await cachedOrRebuildCurrent();
          if (!loaded) return;
          await apply(loaded, value);
          await updateRootSegment(group, values, value);
        }
      }))
    ),

    {
      hook: 'itemx2-setting-lorebook',
      run: async () => {
        const loaded = await cachedOrRebuildCurrent();
        if (!loaded) return;
        const value = !(cachedSettings(loaded.character) || (await settingsFor(loaded.character)))
          .lorebookEncounterEnabled;
        await changeSettings(loaded.character, { lorebookEncounterEnabled: value });
        loaded.lorebookEncounterEnabled = value;
        setStatus(t('ui-settings.036', value ? 'ON' : 'OFF'));
        if (value) await scanLorebookEncounters({ refresh: true, silent: true });
        await updateRootSwitch('.x-risu-itemx2-setting-lorebook', value);
      }
    },
    {
      hook: 'itemx2-setting-lorebook-scan',
      run: async () => {
        await scanLorebookEncounters({ refresh: true });
        // The scan changes the bestiary, not this tab; only the header status moves.
        invalidateLoaded();
        const loaded = await settingsLoaded();
        if (loaded) await patchRootHeader(loaded);
      }
    },
    {
      // Not a plain toggle: turning it on asks the host for module access and
      // can come back refused, which is a third outcome the status must say.
      hook: 'itemx2-setting-module-assets',
      run: async () => {
        const loaded = await cachedOrRebuildCurrent();
        if (!loaded) return;
        const current = cachedSettings(loaded.character) || (await settingsFor(loaded.character));
        let value = false;
        if (current.moduleAssetsEnabled) {
          await changeSettings(loaded.character, { moduleAssetsEnabled: false });
        } else {
          value = await enableModuleAssets(loaded.character, loaded.chat);
          if (!value) await notifyUser(t('ui-settings.035'), 'error');
        }
        loaded.moduleAssetsEnabled = value;
        setStatus(
          value ? t('ui-settings.034') : current.moduleAssetsEnabled ? t('ui-settings.033') : t('ui-settings.032')
        );
        workQueue.remember('render', '');
        await updateRootSwitch('.x-risu-itemx2-setting-module-assets', value);
      }
    },
    ...[
      ['small', t('ui-settings.031')],
      ['medium', t('ui-settings.030')],
      ['large', t('ui-settings.029')]
    ].map(([value, label]) => ({
      hook: `itemx2-setting-font-${value}`,
      run: async () => {
        const loaded = await cachedOrRebuildCurrent();
        if (!loaded) return;
        await changeSettings(loaded.character, { fontScale: value });
        loaded.fontScale = value;
        setStatus(t('ui-settings.028', label));
        for (const scale of ['small', 'medium', 'large']) {
          const button = await queryMainClass(`itemx2-setting-font-${scale}`);
          if (!button) continue;
          if (scale === value) await button.addClass('x-risu-itemx2-font-on');
          else await button.removeClass('x-risu-itemx2-font-on');
        }
      }
    })),
    {
      hook: 'itemx2-setting-storage-cleanup',
      run: armed(
        'storageCleanupArmed',
        'itemx2-setting-storage-cleanup',
        async () => {
          setStatus(t('ui-settings.027'));
        },
        async () => {
          setStatus(t('ui-settings.025'));
          await showRootFeedback(t('ui-settings.024'), 'working', 0);
          try {
            const result = await compactCurrentChatStorage();
            await showRootFeedback(
              t('ui-settings.023', Math.round(result.savedBytes / 1024), result.legacyKeysRemoved),
              'success',
              4200
            );
            if (result.loaded) await openRootInventory({ open: true, tab: 'settings', loaded: result.loaded });
          } catch (error) {
            uiState.storageCleanupArmed = false;
            setStatus(t('ui-settings.022'));
            await showRootFeedback(t('ui-settings.021', error.message || error), 'error', 4200);
            await notifyUser(t('ui-settings.020', error.message || error), 'error');
          }
        }
      )
    },
    {
      hook: 'itemx2-setting-cleanup',
      run: armed(
        'cleanupArmed',
        'itemx2-setting-cleanup',
        async () => {
          setStatus(t('ui-settings.019'));
        },
        async () => {
          setStatus(t('ui-settings.017'));
          await showRootFeedback(t('ui-settings.016'), 'working', 0);
          try {
            const result = await cleanCurrentChatItemx();
            await showRootFeedback(
              t('ui-settings.015', result.cleanedMessages, result.removedMarkers),
              'success',
              3600
            );
            if (result.loaded) await openRootInventory({ open: true, tab: 'settings', loaded: result.loaded });
          } catch (error) {
            uiState.cleanupArmed = false;
            setStatus(t('ui-settings.014'));
            await showRootFeedback(t('ui-settings.013', error.message || error), 'error', 4200);
            await notifyUser(t('ui-settings.012', error.message || error), 'error');
          }
        }
      )
    },
    {
      hook: 'itemx2-setting-old-markers',
      run: armed(
        'oldMarkersArmed',
        'itemx2-setting-old-markers',
        async () => {
          setStatus(t('ui-settings.old-markers-armed'));
        },
        async () => {
          await showRootFeedback(t('ui-settings.old-markers-working'), 'working', 0);
          try {
            const result = await removeOldMarkersCurrent();
            await showRootFeedback(
              t('ui-settings.old-markers-done', result.cleanedMessages, result.removedMarkers),
              'success',
              3600
            );
            if (result.loaded) await openRootInventory({ open: true, tab: 'settings', loaded: result.loaded });
          } catch (error) {
            uiState.oldMarkersArmed = false;
            await showRootFeedback(t('ui-settings.old-markers-failed', error.message || error), 'error', 4200);
          }
        }
      )
    },
    { hook: 'itemx2-setting-old-markers-cancel', run: disarm('oldMarkersArmed', 'itemx2-setting-old-markers') },
    {
      hook: 'itemx2-setting-storage-cleanup-cancel',
      run: disarm('storageCleanupArmed', 'itemx2-setting-storage-cleanup')
    },
    { hook: 'itemx2-setting-cleanup-cancel', run: disarm('cleanupArmed', 'itemx2-setting-cleanup') },
    {
      hook: 'itemx2-setting-rebuild',
      run: async () => {
        invalidateLoaded();
        const loaded = await rebuildCurrent();
        if (loaded) await openRootInventory({ open: true, tab: 'settings', loaded });
      }
    }
  ];
}

export async function openSettingsFromRisuMenu() {
  const active = await context();
  if (!active) {
    uiState.allowDrawerOverSettings = false;
    invalidateHostSettingsVisibility();
    setStatus(t('runtime.004'));
    const message = t('ui-settings.008');
    await notifyUser(message, 'error');
    return;
  }
  setActiveContextKey(active.key);
  uiState.allowDrawerOverSettings = true;
  invalidateHostSettingsVisibility();
  let styled = Boolean(mainDoc()) || (await installMainStyle());
  const loadingStarted = styled ? Date.now() : 0;
  if (styled) await mountRootLoading(t('ui-settings.005'));
  await updateRootLoading(t('ui-settings.006'));
  const connected = await installPipelineHooks({ prompt: true });
  if (!styled) {
    await delay(300);
    styled = await installMainStyle();
    if (styled) await mountRootLoading(t('ui-settings.005'));
  }
  await updateRootLoading(t('ui-settings.004'));
  setStatus(connected && styled ? t('ui-settings.003') : connected ? t('ui-settings.002') : t('ui-settings.001'));
  if (loadingStarted) await delay(Math.max(0, 260 - (Date.now() - loadingStarted)));
  if (styled) await openRootInventory({ open: true, tab: 'settings' });
  else await openInventory('settings');
}
