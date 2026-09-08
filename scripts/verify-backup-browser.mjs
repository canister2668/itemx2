import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = process.env.ITEMX_PLAYWRIGHT_CJS
  ? createRequire(import.meta.url)(process.env.ITEMX_PLAYWRIGHT_CJS)
  : await import('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'dist/itemx2.plugin.js'), 'utf8');
const anchor = '  try {\n    await loadBadgePosition();';
assert.ok(source.includes(anchor));
const extra = `
  context = async () => globalThis.testContext;
  openRootInventory = async () => {};
  globalThis.testBackup = { openBackupPanel, openRootInventoryNow, ensureRootInventoryNow, core: ITEMXCore, backupState };
  return;
`;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const width of [390, 1100]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setContent(
      '<iframe style="position:fixed;inset:0;width:100%;height:100%;border:0" sandbox="allow-scripts allow-modals allow-downloads" srcdoc="<!doctype html><html><head></head><body></body></html>"></iframe>'
    );
    const frame = page.frames()[1];
    await frame.evaluate(() => {
      globalThis.testContext = {
        key: 'old',
        characterIndex: 0,
        chatIndex: 0,
        character: { name: '이사 검증' },
        chat: { id: 'old', message: [], scriptstate: { other: 'keep' } }
      };
      globalThis.writes = 0;
      globalThis.hides = 0;
      globalThis.Risuai = {
        showContainer: async (mode) => {
          if (mode !== 'fullscreen') throw Error('unsupported mode');
        },
        hideContainer: async () => {
          hides++;
        },
        getChatFromIndex: async () => testContext.chat,
        setChatToIndex: async (_c, _h, chat) => {
          writes++;
          testContext.chat = chat;
        }
      };
    });
    await frame.evaluate(source.replace(anchor, extra + anchor));
    await frame.evaluate(async () => {
      const core = testBackup.core;
      testContext.chat.message = [
        {
          role: 'char',
          data:
            '기존 대화 ' +
            core.marker({
              v: 2,
              event: {
                kind: 'exam',
                item: core.normalizeItem({
                  id: 'sword',
                  name: '검',
                  possession: 'owned',
                  location: 'inventory',
                  count: 2
                }).item
              }
            })
        }
      ];
      await testBackup.openBackupPanel();
    });
    await frame.evaluate(async () => {
      await testBackup.ensureRootInventoryNow();
      await testBackup.openRootInventoryNow();
    });
    assert.equal(await frame.evaluate(() => hides), 0, 'background drawer refresh must not close backup');
    await frame.locator('#ix-export').click();
    await frame.locator('#ix-download').waitFor({ state: 'visible' });
    const backup = await frame.locator('#ix-export-text').inputValue();
    const downloadPromise = page.waitForEvent('download');
    await frame.locator('#ix-download').click();
    const download = await downloadPromise;
    assert.equal(await readFile(await download.path(), 'utf8'), backup);
    await frame.locator('#ix-copy').click();
    assert.match(await frame.locator('#ix-status').textContent(), /복사/);
    await frame.locator('#ix-close').click();
    await frame.evaluate(async () => {
      testContext = {
        ...testContext,
        key: 'new',
        chat: {
          id: 'new',
          name: '손요약 새 채팅',
          message: [{ role: 'char', data: '손요약 인사말' }],
          scriptstate: { other: 'keep' }
        }
      };
      await testBackup.openBackupPanel();
    });
    if (width === 390)
      await frame
        .locator('#ix-file')
        .setInputFiles({ name: 'itemx-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    else await frame.locator('#ix-import-text').fill(backup);
    await frame.locator('#ix-preview').click();
    await frame.locator('#ix-import:not([disabled])').waitFor();
    assert.match(await frame.locator('#ix-preview-text').textContent(), /아이템 1/);
    assert.equal(await frame.evaluate(() => writes), 0);
    assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: resolve(root, `dist/backup-${width}.png`), fullPage: true });
    await frame.locator('#ix-import').click();
    await frame.waitForFunction(() => document.getElementById('ix-status').textContent.includes('불러오기 완료'));
    const result = await frame.evaluate(() => ({
      writes,
      chat: testContext.chat,
      item: testBackup.backupState(testContext).snapshot.registry.items.sword
    }));
    assert.equal(result.writes, 1);
    assert.equal(result.item.count, 2);
    assert.equal(result.chat.message[0].data, '손요약 인사말');
    assert.equal(result.chat.scriptstate.other, 'keep');
    assert.deepEqual(errors, []);
    console.log(
      `backup ${width}px: sandbox download verified, ${width === 390 ? 'file' : 'paste'} import verified, one write, no overflow/errors`
    );
    await page.close();
  }
} finally {
  await browser.close();
}
