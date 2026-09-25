/* ITEMX portraits owner. Concatenated inside the runtime closure. */
  function characterAssetFingerprint(character) {
    const additional = character?.additionalAssets || [],
      emotions = character?.emotionImages || [],
      cc = character?.ccAssets || [];
    const last = additional[additional.length - 1];
    return `${additional.length}:${emotions.length}:${cc.length}:${additional[0]?.[0] || ''}:${last?.[0] || ''}:${cc[0]?.name || ''}`;
  }

  function characterPortraitAssets(character, max = ITEMXCodex.ASSET_CATALOG_MAX) {
    const key = `${character?.chaId || character?.id || 'character'}:${characterAssetFingerprint(character)}`;
    if (portraitsState.characterAssetCache.key === key && Date.now() - portraitsState.characterAssetCache.at < 30000)
      return portraitsState.characterAssetCache.rows;
    const rows = ITEMXCodex.assetCatalog(character, max, true);
    ITEMXCodex.portraitAssetIndex(rows);
    portraitsState.characterAssetCache = { key, at: Date.now(), rows };
    return rows;
  }

  function combinedPortraitAssets(character, moduleAssets = [], max = ITEMXCodex.ASSET_CATALOG_MAX) {
    const extra = characterPortraitAssets(character, max);
    if (!extra.length) {
      const rows = moduleAssets || [];
      return rows.length <= max ? rows : rows.slice(0, max);
    }
    if (!moduleAssets?.length) return extra.length <= max ? extra : extra.slice(0, max);
    const combinedKey = `${portraitsState.characterAssetCache.key}|${portraitsState.moduleAssetCache.key}|${extra.length}|${moduleAssets.length}`;
    if (portraitsState.combinedAssetCache.key === combinedKey && Date.now() - portraitsState.combinedAssetCache.at < 30000)
      return portraitsState.combinedAssetCache.rows;
    const rows = extra.slice(),
      seen = new Set(rows.map((row) => row.name));
    for (const row of moduleAssets) {
      if (rows.length >= max || !row?.name || !row?.id || seen.has(row.name)) continue;
      seen.add(row.name);
      rows.push(row);
    }
    ITEMXCodex.portraitAssetIndex(rows);
    portraitsState.combinedAssetCache = { key: combinedKey, at: Date.now(), rows };
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
    if (portraitsState.moduleAssetCache.key === key && Date.now() - portraitsState.moduleAssetCache.at < 30000)
      return portraitsState.moduleAssetCache.rows;
    try {
      const database = await Risuai.getDatabase([
        'modules',
        'enabledModules',
        'moduleIntergration',
        'personas',
        'selectedPersona'
      ]);
      if (!database) {
        hostState.permissions.db = false;
        portraitsState.moduleAssetCache = { key, at: Date.now(), rows: [] };
        return [];
      }
      hostState.permissions.db = true;
      const rows = ITEMXCodex.activeModuleAssetCatalog(database, character, chat, ITEMXCodex.ASSET_CATALOG_MAX);
      ITEMXCodex.portraitAssetIndex(rows);
      portraitsState.moduleAssetCache = { key, at: Date.now(), rows };
      return rows;
    } catch (error) {
      hostState.permissions.db = false;
      portraitsState.moduleAssetCache = { key, at: Date.now(), rows: [] };
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
        hostState.permissions.db = false;
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
        hostState.permissions.db = false;
        return false;
      }
      hostState.permissions.db = true;
      await setModuleAssetsEnabled(character, true);
      const rows = ITEMXCodex.activeModuleAssetCatalog(probe, character, chat, ITEMXCodex.ASSET_CATALOG_MAX);
      ITEMXCodex.portraitAssetIndex(rows);
      portraitsState.moduleAssetCache = {
        key: `${character?.chaId || character?.id || 'character'}:${chat?.id || 'chat'}`,
        at: Date.now(),
        rows
      };
      return true;
    } catch (error) {
      hostState.permissions.db = false;
      debugRecord('module portrait permission', error?.message || String(error));
      return false;
    }
  }

  function prepareInlinePortraits(ctx, codexSnapshot, settings) {
    if (
      typeof Risuai.readImage !== 'function' ||
      !codexSnapshot?.monsters?.order?.length ||
      ctx.key !== pipelineState.activeContextKey
    )
      return;
    const key = `${ctx.key}:${Number(settings.moduleAssetsEnabled)}:${encounterRegistryFingerprint(codexSnapshot)}`;
    void dispatch('portraits', () => workQueue.attempt('portraits', key,
      () => loadCodexPortraits(ctx.character, ctx.chat, codexSnapshot, settings, true)
        .catch((error) => debugRecord('portrait preparation', error?.message || String(error))),
      () => true, 30000));
  }

  async function portraitThumbnail(cacheKey, image) {
    if (portraitsState.portraitThumbnailCache.has(cacheKey)) return portraitsState.portraitThumbnailCache.get(cacheKey);
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
              context.drawImage(
                bitmap,
                (bitmap.width - side) / 2,
                (bitmap.height - side) / 2,
                side,
                side,
                0,
                0,
                96,
                96
              );
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
      portraitsState.portraitThumbnailCache.set(cacheKey, thumbnail);
      while (portraitsState.portraitThumbnailCache.size > 64)
        portraitsState.portraitThumbnailCache.delete(portraitsState.portraitThumbnailCache.keys().next().value);
      return thumbnail;
    });
    portraitsState.portraitThumbnailCache.set(cacheKey, work);
    return work;
  }

  async function loadCodexPortraits(character, chat, codexSnapshot, settings, inlineOnly = false) {
    const ownerKey = pipelineState.activeContextKey;
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
    if (pipelineState.activeContextKey === ownerKey)
      portraitsState.inlinePortraitCatalog = {
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
      const asset = ITEMXCodex.assetForEntity(catalog, monster, narrative);
      if (!asset) continue;
      const key = `${character?.chaId || character?.id || 'character'}:${asset.id}:${asset.ext || ''}`;
      if (!(inlineOnly && portraitsState.portraitThumbnailCache.has(key)) && !portraitsState.portraitCache.has(key))
        missingAssets.set(asset.id, asset);
    }
    const portraitJob = workQueue.token;
    const rawAssets = missingAssets.size ? await workQueue.external(async () => {
      const entries = [...missingAssets.values()], values = new Map();
      const deadline = Date.now() + 5000; // One budget for all optional images.
      let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(4, entries.length) }, async () => {
        while (cursor < entries.length) {
          const asset = entries[cursor++];
          for (let attempt = 0; attempt < 3; attempt += 1) {
            if (hostState.unloading || portraitJob?.cancelled || Date.now() >= deadline) return;
            let raw = null;
            try { raw = await withTimeout(Risuai.readImage(asset.id), Math.max(1, deadline - Date.now()), 'Portrait read timed out'); } catch {}
            if (raw) { values.set(asset.id, raw); break; }
            if (attempt < 2) await delay(Math.max(0, Math.min(280 * (attempt + 1), deadline - Date.now())));
          }
        }
      }));
      return values;
    }) : new Map();
    if (pipelineState.activeContextKey !== ownerKey) return result;
    let portraitCursor = 0;
    const loadNextPortrait = async () => {
      while (portraitCursor < monsters.length) {
        const monster = monsters[portraitCursor++];
        const asset = ITEMXCodex.assetForEntity(catalog, monster, narrative);
        if (!asset) continue;
        const cacheKey = `${character?.chaId || character?.id || 'character'}:${asset.id}:${asset.ext || ''}`;
        if (inlineOnly && portraitsState.portraitThumbnailCache.has(cacheKey)) {
          result[monster.id] = await portraitsState.portraitThumbnailCache.get(cacheKey);
          continue;
        }
        if (portraitsState.portraitCache.has(cacheKey)) {
          const image = portraitsState.portraitCache.get(cacheKey);
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
              portraitsState.portraitCache.set(cacheKey, image);

              while (portraitsState.portraitCache.size > 24 || [...portraitsState.portraitCache.values()].reduce((sum, value) => sum + value.length, 0) > 16 * 1024 * 1024) {
                const oldest = portraitsState.portraitCache.keys().next().value;
                portraitsState.portraitCache.delete(oldest);

              }
            }
          }
        } catch {}
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, monsters.length) }, () => loadNextPortrait()));
    return result;
  }
