import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

export async function presentationRuntime(overrides = {}, extra = '', sourceOverride = null) {
  const source = sourceOverride ?? await readFile(new URL('../../dist/itemx2.plugin.js', import.meta.url), 'utf8');
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
      `${!source.includes('const stateOwners =') ? '' : `const inspection = {}; const runtime = new Proxy(inspection, { get(target, key) { for (const owner of Object.values(stateOwners)) if (key in owner) return owner[key]; return target[key]; }, set(target, key, value) { for (const owner of Object.values(stateOwners)) if (key in owner) { owner[key] = value; return true; } target[key] = value; return true; } });`}\n${source.includes('function refreshReplayCache(') ? '' : 'const refreshReplayCache = checkpointReplay; const ITEMXStorage = undefined; const ITEMXSettings = undefined; const readReplayBaseline = replayCheckpoint; const assertLogReadable = checkpointFrozen;'}\n${extra}\n  globalThis.preview = { runtime, ui, rootInventoryHtml, refreshLatest, presentationRecord, itemDetailHtml, skillPageHtml, monsterPageHtml, codexInlineEventHtml, displayHandler, armEventBursts, commitEventBursts, flushEventBursts, clearEventBursts, eventBurstKey, repairOneItem, embeddedViewCode, inlineViewPayload, readCheckpointRecord, replayCheckpoint: readReplayBaseline, checkpointFrozen: assertLogReadable, checkpointStatus, createCheckpoint, checkpointReplay: refreshReplayCache, refreshReplayCache, storage: ITEMXStorage, settings: ITEMXSettings, frozenBannerHtml, rootSettingActions, eventHitsMainClass, settingsPanelHtml, SETTINGS_SKINS, settingsDomainControls, settingsFontChoices, settingsPositionChoices, settingsStorageParts, settingsDebugLog, backupSettingsHtml, core: ITEMXCore, renderer: ITEMXRenderer, codex: ITEMXCodex, backup: ITEMXBackup, quality: ITEMXQuality, style: ITEMX_STYLE + rootDrawerStyle() };\n  return;\n${anchor}`
    ),
    sandbox
  );
  return { ...sandbox.preview, recoverAuxiliaryOutput: sandbox.testRecovery };
}
