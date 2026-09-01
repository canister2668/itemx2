import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const playwrightPath = process.env.ITEMX_PLAYWRIGHT;
const playwright = process.env.ITEMX_PLAYWRIGHT_CJS ? createRequire(import.meta.url)(process.env.ITEMX_PLAYWRIGHT_CJS) : await import(playwrightPath || 'playwright');
const { chromium } = playwright;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plugin = await readFile(resolve(root, 'dist/itemx2.plugin.js'), 'utf8');
const browser = await chromium.launch({ headless: true, ...(process.env.ITEMX_CHROMIUM ? { executablePath: process.env.ITEMX_CHROMIUM } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
await page.setContent('<!doctype html><html><head></head><body><button id="outside">대화 화면</button></body></html>');
await page.evaluate(() => {
  const storage = new Map();
  const chat = { id: 'chat-ui', message: [], scriptstate: {} };
  const wrap = (node) => node ? ({
    node,
    setAttribute: async (name, value) => node.setAttribute(name, value),
    setClassName: async (value) => { node.className = value; },
    setTextContent: async (value) => { node.textContent = value; },
    setInnerHTML: async (value) => { node.innerHTML = value; },
    appendChild: async (child) => node.appendChild(child.node || child),
    remove: async () => node.remove()
  }) : null;
  const safeDocument = {
    querySelector: async (selector) => wrap(document.querySelector(selector)),
    createElement: async (tag) => wrap(document.createElement(tag)),
    appendChild: async (child) => document.documentElement.appendChild(child.node || child)
  };
  window.__itemxUiTest = { registrations: [], handlers: {}, replacers: {}, listeners: {}, requestedModes: [], container: null, size: null, showCalls: 0, hideCalls: 0, resizeFails: true, storage };
  window.Risuai = {
    pluginStorage: { getItem: async (key) => storage.get(key) ?? null, setItem: async (key, value) => storage.set(key, value) },
    getCurrentCharacterIndex: async () => 0, getCurrentChatIndex: async () => 0,
    getCharacter: async () => ({ chaId: 'char-ui', name: 'UI 시험 봇' }),
    getChatFromIndex: async () => structuredClone(chat), setChatToIndex: async () => {},
    registerButton: async (arg, callback) => { const hostButton = document.createElement('button'); hostButton.setAttribute('aria-label', arg.name); hostButton.innerHTML = arg.iconType === 'img' ? `<div><img src="${arg.icon}" alt=""></div>` : `<div>${arg.icon}</div>`; document.body.appendChild(hostButton); window.__itemxUiTest.registrations.push({ type: 'button', arg, callback }); return { id: arg.id }; },
    registerSetting: async (name, callback, icon, iconType, id) => { window.__itemxUiTest.registrations.push({ type: 'setting', name, callback }); return { id }; },
    requestPluginPermission: async () => true,
    addRisuScriptHandler: async (mode, callback) => { window.__itemxUiTest.handlers[mode] = callback; }, removeRisuScriptHandler: async () => {},
    addRisuReplacer: async (mode, callback) => { window.__itemxUiTest.replacers[mode] = callback; }, removeRisuReplacer: async () => {},
    addRisuChatListener: async (mode, callback) => { window.__itemxUiTest.listeners[mode] = callback; }, unregisterUIPart: async () => {},
    getRootDocument: async () => safeDocument, onUnload: async () => {}, alertError: async (message) => { window.__itemxUiTest.alert = message; },
    showContainer: async (type) => { window.__itemxUiTest.showCalls += 1; window.__itemxUiTest.requestedModes.push(type); window.__itemxUiTest.container = type; },
    resizeContainer: async (height, width) => { window.__itemxUiTest.size = { height, width }; if (window.__itemxUiTest.resizeFails) throw new Error('API method resizeContainer not found'); },
    hideContainer: async () => { window.__itemxUiTest.hideCalls += 1; window.__itemxUiTest.container = 'hidden'; }
  };
});
await page.addScriptTag({ content: plugin });
await page.waitForFunction(() => window.__itemxUiTest.registrations.some((entry) => entry.type === 'button'));
await page.waitForSelector('style[x-itemx2-style="owner"]', { state: 'attached' });
const badge = await page.evaluate(() => {
  const button = document.querySelector('button[aria-label="ITEMX"]');
  const rect = button.getBoundingClientRect();
  return { width: rect.width, height: rect.height, text: button.textContent.trim(), image: button.querySelector('img')?.src.startsWith('data:image/svg+xml') };
});
if (badge.width !== 48 || badge.height !== 176 || badge.text !== '' || !badge.image) throw new Error(`vertical badge failed: ${JSON.stringify(badge)}`);

await page.evaluate(async () => window.__itemxUiTest.registrations.find((entry) => entry.type === 'button').callback());
await page.waitForSelector('[x-itemx2-drawer="owner"] .itemx2-root-panel');
const drawer = await page.evaluate(() => {
  const root = document.querySelector('[x-itemx2-drawer="owner"]');
  const panel = root.querySelector('.itemx2-root-panel');
  const rect = panel.getBoundingClientRect();
  return {
    rootPointer: getComputedStyle(root).pointerEvents,
    panelPointer: getComputedStyle(panel).pointerEvents,
    width: rect.width, height: rect.height,
    title: panel.querySelector('.itemx-ph-title')?.textContent.trim(),
    filters: [...panel.querySelectorAll('.itemx2-root-filters label')].map((node) => node.textContent.trim().split(' ')[0]),
    showCalls: window.__itemxUiTest.showCalls,
    hideCalls: window.__itemxUiTest.hideCalls,
    container: window.__itemxUiTest.container
  };
});
if (drawer.rootPointer !== 'none' || drawer.panelPointer !== 'auto' || drawer.width >= 390 || drawer.height >= 844 || drawer.title !== 'UI 시험 봇' || drawer.filters.join(',') !== '전체,보유,장착,관찰,소실' || drawer.showCalls !== 0 || drawer.container !== 'hidden') throw new Error(`nonblocking root drawer failed: ${JSON.stringify(drawer)}`);

await page.locator('label[for="itemx2-root-open"]').click();
await page.waitForFunction(() => !document.querySelector('#itemx2-root-open')?.checked);
await page.waitForTimeout(170);
const closed = await page.evaluate(() => ({ checked: document.querySelector('#itemx2-root-open')?.checked, visibility: getComputedStyle(document.querySelector('.itemx2-root-layer')).visibility, showCalls: window.__itemxUiTest.showCalls }));
if (closed.checked || closed.visibility !== 'hidden' || closed.showCalls !== 0) throw new Error(`native close failed: ${JSON.stringify(closed)}`);

await page.evaluate(async () => {
  await window.__itemxUiTest.handlers.output?.('스트리밍 중');
  window.__itemxUiTest.handlers.display?.('스트리밍 중');
  await window.__itemxUiTest.listeners.output?.();
  await new Promise((resolve) => setTimeout(resolve, 120));
});
const streaming = await page.evaluate(() => ({ checked: document.querySelector('#itemx2-root-open')?.checked, showCalls: window.__itemxUiTest.showCalls }));
if (streaming.checked || streaming.showCalls !== 0) throw new Error(`streaming reopened drawer: ${JSON.stringify(streaming)}`);

await page.evaluate(async () => window.__itemxUiTest.registrations.find((entry) => entry.type === 'button').callback());
await page.waitForFunction(() => document.querySelector('#itemx2-root-open')?.checked === true);
const reopened = await page.evaluate(() => ({ roots: document.querySelectorAll('[x-itemx2-drawer="owner"]').length, checked: document.querySelector('#itemx2-root-open')?.checked, showCalls: window.__itemxUiTest.showCalls }));
if (reopened.roots !== 1 || !reopened.checked || reopened.showCalls !== 0) throw new Error(`drawer recreate failed: ${JSON.stringify(reopened)}`);

await page.evaluate(async () => window.__itemxUiTest.registrations.find((entry) => entry.type === 'setting').callback());
await page.waitForFunction(() => window.__itemxUiTest.showCalls === 1);
const settings = await page.evaluate(() => ({ mode: window.__itemxUiTest.container, requested: window.__itemxUiTest.requestedModes.at(-1), active: document.querySelector('.itemx-main-tab-on')?.textContent.trim(), fallback: document.querySelector('.itemx-plugin-stage')?.classList.contains('itemx-plugin-stage-fallback') }));
if (settings.mode !== 'fullscreen' || settings.requested !== 'fullscreen' || settings.active !== '설정' || !settings.fallback) throw new Error(`explicit settings fallback failed: ${JSON.stringify(settings)}`);
if (pageErrors.length) throw new Error(`browser errors: ${JSON.stringify(pageErrors)}`);
console.log(JSON.stringify({ badge, drawer, closed, streaming, reopened, settings, pageErrors }));
await browser.close();
