/* Encounter portraits: asset catalogs, image reads and thumbnails. */
import * as Codex from './engine/codex.js';
import * as Core from './engine/core.js';
import { isUnloading, setPermission } from './connection.js';
import { host } from './host.js';
import { debugRecord, delay, dispatch, withTimeout, workQueue } from './kernel.js';
import { activeContextKey } from './session.js';
import { changeSettings } from './settings.js';
// Private caches. Full portraits are bounded by count and bytes; the 96px
// thumbnails the chat cards use are bounded by count.
const portraitCache = new Map();
const portraitThumbnailCache = new Map();
let inlinePortraitCatalog = null;
let moduleAssetCache = { key: '', at: 0, rows: [] };
let characterAssetCache = { key: '', at: 0, rows: [] };
let combinedAssetCache = { key: '', at: 0, rows: [] };

// A context switch or a module-asset toggle makes every cached catalog stale.
export function resetPortraitContext() {
  inlinePortraitCatalog = null;
}

// Cache occupancy, for the settings debug panel and the bound tests.
export const portraitCacheStats = () => ({
  images: portraitCache.size,
  imageBytes: [...portraitCache.values()].reduce((sum, value) => sum + value.length, 0),
  thumbnails: portraitThumbnailCache.size
});

export function invalidateModuleAssets() {
  moduleAssetCache = { key: '', at: 0, rows: [] };
}

// Thumbnails for chat cards, from memory only: the display hook must never
// call back into the host.
export function inlinePortraitImages(entities, contextKey) {
  const portraits = {},
    cached = inlinePortraitCatalog;
  if (cached?.contextKey !== contextKey) return portraits;
  for (const entity of entities) {
    const asset = Codex.assetForEntity(cached.catalog, entity, cached.narrative);
    if (!asset) continue;
    const image = portraitThumbnailCache.get(`${cached.characterId}:${asset.id}:${asset.ext || ''}`);
    if (typeof image === 'string' && image) portraits[entity.id] = image;
  }
  return portraits;
}

export function characterAssetFingerprint(character) {
  const additional = character?.additionalAssets || [],
    emotions = character?.emotionImages || [],
    cc = character?.ccAssets || [];
  const last = additional[additional.length - 1];
  return `${additional.length}:${emotions.length}:${cc.length}:${additional[0]?.[0] || ''}:${last?.[0] || ''}:${cc[0]?.name || ''}`;
}

export function characterPortraitAssets(character, max = Codex.ASSET_CATALOG_MAX) {
  const key = `${character?.chaId || character?.id || 'character'}:${characterAssetFingerprint(character)}`;
  if (characterAssetCache.key === key && Date.now() - characterAssetCache.at < 30000) return characterAssetCache.rows;
  const rows = Codex.assetCatalog(character, max, true);
  Codex.portraitAssetIndex(rows);
  characterAssetCache = { key, at: Date.now(), rows };
  return rows;
}

export function combinedPortraitAssets(character, moduleAssets = [], max = Codex.ASSET_CATALOG_MAX) {
  const extra = characterPortraitAssets(character, max);
  if (!extra.length) {
    const rows = moduleAssets || [];
    return rows.length <= max ? rows : rows.slice(0, max);
  }
  if (!moduleAssets?.length) return extra.length <= max ? extra : extra.slice(0, max);
  const combinedKey = `${characterAssetCache.key}|${moduleAssetCache.key}|${extra.length}|${moduleAssets.length}`;
  if (combinedAssetCache.key === combinedKey && Date.now() - combinedAssetCache.at < 30000)
    return combinedAssetCache.rows;
  const rows = extra.slice(),
    seen = new Set(rows.map((row) => row.name));
  for (const row of moduleAssets) {
    if (rows.length >= max || !row?.name || !row?.id || seen.has(row.name)) continue;
    seen.add(row.name);
    rows.push(row);
  }
  Codex.portraitAssetIndex(rows);
  combinedAssetCache = { key: combinedKey, at: Date.now(), rows };
  return rows;
}

export function encounterEntities(snapshot) {
  const monsters = snapshot?.monsters;
  return (monsters?.order || []).map((id) => monsters.entries?.[id]).filter(Boolean);
}

export function encounterRegistryFingerprint(snapshot) {
  const monsters = snapshot?.monsters;
  const rows = (monsters?.order || []).map((id) => monsters.entries?.[id]).filter(Boolean);
  return Core.fnv1a(JSON.stringify(rows));
}

export async function modulePortraitAssets(settings, character, chat) {
  if (!settings?.moduleAssetsEnabled || typeof host().getDatabase !== 'function') return [];
  const key = `${character?.chaId || character?.id || 'character'}:${chat?.id || 'chat'}`;
  if (moduleAssetCache.key === key && Date.now() - moduleAssetCache.at < 30000) return moduleAssetCache.rows;
  try {
    const database = await host().getDatabase([
      'modules',
      'enabledModules',
      'moduleIntergration',
      'personas',
      'selectedPersona'
    ]);
    if (!database) {
      setPermission('db', false);
      moduleAssetCache = { key, at: Date.now(), rows: [] };
      return [];
    }
    setPermission('db', true);
    const rows = Codex.activeModuleAssetCatalog(database, character, chat, Codex.ASSET_CATALOG_MAX);
    Codex.portraitAssetIndex(rows);
    moduleAssetCache = { key, at: Date.now(), rows };
    return rows;
  } catch (error) {
    setPermission('db', false);
    moduleAssetCache = { key, at: Date.now(), rows: [] };
    debugRecord('module portrait assets', error?.message || String(error));
    return [];
  }
}

export async function enableModuleAssets(character, chat) {
  if (typeof host().getDatabase !== 'function') return false;
  try {
    if (typeof host().requestPluginPermission === 'function' && (await host().requestPluginPermission('db')) !== true) {
      setPermission('db', false);
      return false;
    }
    const probe = await host().getDatabase([
      'modules',
      'enabledModules',
      'moduleIntergration',
      'personas',
      'selectedPersona'
    ]);
    if (!probe) {
      setPermission('db', false);
      return false;
    }
    setPermission('db', true);
    await changeSettings(character, { moduleAssetsEnabled: true });
    const rows = Codex.activeModuleAssetCatalog(probe, character, chat, Codex.ASSET_CATALOG_MAX);
    Codex.portraitAssetIndex(rows);
    moduleAssetCache = {
      key: `${character?.chaId || character?.id || 'character'}:${chat?.id || 'chat'}`,
      at: Date.now(),
      rows
    };
    return true;
  } catch (error) {
    setPermission('db', false);
    debugRecord('module portrait permission', error?.message || String(error));
    return false;
  }
}

export function prepareInlinePortraits(ctx, codexSnapshot, settings) {
  if (
    typeof host().readImage !== 'function' ||
    !codexSnapshot?.monsters?.order?.length ||
    ctx.key !== activeContextKey()
  )
    return;
  const key = `${ctx.key}:${Number(settings.moduleAssetsEnabled)}:${encounterRegistryFingerprint(codexSnapshot)}`;
  void dispatch('portraits', () =>
    workQueue.attempt(
      'portraits',
      key,
      () =>
        loadCodexPortraits(ctx.character, ctx.chat, codexSnapshot, settings, true).catch((error) =>
          debugRecord('portrait preparation', error?.message || String(error))
        ),
      () => true,
      30000
    )
  );
}

export async function portraitThumbnail(cacheKey, image) {
  if (portraitThumbnailCache.has(cacheKey)) return portraitThumbnailCache.get(cacheKey);
  const work = Promise.resolve().then(async () => {
    let thumbnail = '';
    try {
      if (image.length <= 24576) thumbnail = image;
      else if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function') {
        const match = /^data:(image\/[^;]+);base64,(.+)$/.exec(image);
        if (match) {
          const bytes = Uint8Array.from(atob(match[2]), (one) => one.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([bytes], { type: match[1] }));
          try {
            const canvas = new OffscreenCanvas(96, 96),
              context = canvas.getContext('2d');
            const side = Math.min(bitmap.width, bitmap.height);
            context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 96, 96);
            const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.72 });
            const encoded = `data:${blob.type};base64,${btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())))}`;
            if (encoded.length <= 24576) thumbnail = encoded;
          } finally {
            bitmap.close();
          }
        }
      }
    } catch (error) {
      debugRecord('portrait thumbnail', error?.message || String(error));
    }
    portraitThumbnailCache.set(cacheKey, thumbnail);
    while (portraitThumbnailCache.size > 64) portraitThumbnailCache.delete(portraitThumbnailCache.keys().next().value);
    return thumbnail;
  });
  portraitThumbnailCache.set(cacheKey, work);
  return work;
}

export async function loadCodexPortraits(character, chat, codexSnapshot, settings, inlineOnly = false) {
  const ownerKey = activeContextKey();
  const result = {},
    catalog = combinedPortraitAssets(
      character,
      await modulePortraitAssets(settings, character, chat),
      Codex.ASSET_CATALOG_MAX
    );
  if (typeof host().readImage !== 'function') return result;
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
    .map((message) => Core.messageText(message))
    .join('\n');
  if (activeContextKey() === ownerKey)
    inlinePortraitCatalog = {
      contextKey: ownerKey,
      characterId: character?.chaId || character?.id || 'character',
      catalog,
      narrative
    };
  // Only host I/O yields ownership. The external region uses local values;
  // cache/catalog writes happen after our queue job resumes. Yield once for
  // the whole batch, never once per concurrent worker (which has no owner).
  const missingAssets = new Map();
  for (const monster of monsters) {
    const asset = Codex.assetForEntity(catalog, monster, narrative);
    if (!asset) continue;
    const key = `${character?.chaId || character?.id || 'character'}:${asset.id}:${asset.ext || ''}`;
    if (!(inlineOnly && portraitThumbnailCache.has(key)) && !portraitCache.has(key)) missingAssets.set(asset.id, asset);
  }
  const portraitJob = workQueue.token;
  const rawAssets = missingAssets.size
    ? await workQueue.external(async () => {
        const entries = [...missingAssets.values()],
          values = new Map();
        const deadline = Date.now() + 5000; // One budget for all optional images.
        let cursor = 0;
        await Promise.all(
          Array.from({ length: Math.min(4, entries.length) }, async () => {
            while (cursor < entries.length) {
              const asset = entries[cursor++];
              for (let attempt = 0; attempt < 3; attempt += 1) {
                if (isUnloading() || portraitJob?.cancelled || Date.now() >= deadline) return;
                let raw = null;
                try {
                  raw = await withTimeout(
                    host().readImage(asset.id),
                    Math.max(1, deadline - Date.now()),
                    'Portrait read timed out'
                  );
                } catch {}
                if (raw) {
                  values.set(asset.id, raw);
                  break;
                }
                if (attempt < 2) await delay(Math.max(0, Math.min(280 * (attempt + 1), deadline - Date.now())));
              }
            }
          })
        );
        return values;
      })
    : new Map();
  if (activeContextKey() !== ownerKey) return result;
  let portraitCursor = 0;
  const loadNextPortrait = async () => {
    while (portraitCursor < monsters.length) {
      const monster = monsters[portraitCursor++];
      const asset = Codex.assetForEntity(catalog, monster, narrative);
      if (!asset) continue;
      const cacheKey = `${character?.chaId || character?.id || 'character'}:${asset.id}:${asset.ext || ''}`;
      if (inlineOnly && portraitThumbnailCache.has(cacheKey)) {
        result[monster.id] = await portraitThumbnailCache.get(cacheKey);
        continue;
      }
      if (portraitCache.has(cacheKey)) {
        const image = portraitCache.get(cacheKey);
        const thumbnail = await portraitThumbnail(cacheKey, image);
        result[monster.id] = inlineOnly ? thumbnail : image;
        continue;
      }
      try {
        const image = asDataUrl(rawAssets.get(asset.id), asset.ext);
        if (image) {
          const thumbnail = await portraitThumbnail(cacheKey, image);
          result[monster.id] = inlineOnly ? thumbnail : image;
          if (!inlineOnly && image.length <= 4 * 1024 * 1024) {
            portraitCache.set(cacheKey, image);

            while (
              portraitCache.size > 24 ||
              [...portraitCache.values()].reduce((sum, value) => sum + value.length, 0) > 16 * 1024 * 1024
            ) {
              const oldest = portraitCache.keys().next().value;
              portraitCache.delete(oldest);
            }
          }
        }
      } catch {}
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, monsters.length) }, () => loadNextPortrait()));
  return result;
}
