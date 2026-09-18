import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

export async function presentationRuntime(overrides = {}, extra = '') {
  const source = await readFile(new URL('../../dist/itemx2.plugin.js', import.meta.url), 'utf8');
  const anchor = '  try {\n    await loadBadgePosition();';
  if (!source.includes(anchor)) throw new Error('runtime bootstrap anchor missing');
  const sandbox = vm.createContext({
    console,
    TextEncoder,
    TextDecoder,
    Buffer,
    structuredClone,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Risuai: {},
    ...overrides
  });
  await vm.runInContext(
    source.replace(
      anchor,
      `${extra}\n  globalThis.preview = { runtime, ui, refreshLatest, presentationRecord, itemDetailHtml, skillPageHtml, monsterPageHtml, codexInlineEventHtml, displayHandler, armEventBursts, commitEventBursts, flushEventBursts, clearEventBursts, eventBurstKey, repairOneItem, embeddedViewCode, inlineViewPayload, readCheckpointRecord, replayCheckpoint, checkpointFrozen, checkpointStatus, createCheckpoint, checkpointReplay, frozenBannerHtml, rootSettingActions, eventHitsMainClass, settingsPanelHtml, SETTINGS_SKINS, settingsDomainControls, settingsFontChoices, settingsPositionChoices, settingsStorageParts, settingsDebugLog, backupSettingsHtml, core: ITEMXCore, renderer: ITEMXRenderer, codex: ITEMXCodex, backup: ITEMXBackup, quality: ITEMXQuality, style: ITEMX_STYLE + rootDrawerStyle() };\n  return;\n${anchor}`
    ),
    sandbox
  );
  return { ...sandbox.preview, recoverAuxiliaryOutput: sandbox.testRecovery };
}
