/* A fake RisuAI plugin API v3 host. Only stock API members exist; every call
 * is recorded so tests can assert what the runtime asked of the host. */
import { createFakeDocument } from './fake-dom.mjs';

export function createFakeHost({
  chat = { id: 'chat', message: [], scriptstate: {} },
  character = { chaId: 'bot', name: '검증 봇' },
  settings = null,
  document: withDocument = false,
  llm = null,
  permission = true,
  lorebook = [],
  database = null
} = {}) {
  const state = {
    chat: structuredClone(chat),
    character,
    characterIndex: 0,
    chatIndex: 0,
    storage: new Map(settings ? [['itemx:settings', JSON.stringify(settings)]] : []),
    local: new Map(),
    handlers: {},
    replacers: {},
    listeners: [],
    uiParts: [],
    reads: 0,
    writes: 0,
    calls: [],
    llmCalls: [],
    unload: null,
    home: false
  };
  const dom = withDocument ? createFakeDocument() : null;
  const note = (name) => state.calls.push(name);
  const api = {
    apiVersion: '3.0',
    pluginStorage: {
      getItem: async (key) => (note('pluginStorage.getItem'), state.storage.get(key) ?? null),
      setItem: async (key, value) => (note('pluginStorage.setItem'), state.storage.set(key, value)),
      removeItem: async (key) => state.storage.delete(key),
      keys: async () => [...state.storage.keys()]
    },
    safeLocalStorage: {
      getItem: async (key) => state.local.get(key) ?? null,
      setItem: async (key, value) => state.local.set(key, value)
    },
    getCurrentCharacterIndex: async () => {
      note('getCurrentCharacterIndex');
      if (state.home) throw new Error('Cannot read properties of undefined (reading chatPage)');
      return state.characterIndex;
    },
    getCurrentChatIndex: async () => (note('getCurrentChatIndex'), state.chatIndex),
    getCharacter: async () => (note('getCharacter'), state.character),
    getChatFromIndex: async () => {
      note('getChatFromIndex');
      state.reads += 1;
      state.onRead?.(state);
      return state.chat ? structuredClone(state.chat) : null;
    },
    setChatToIndex: async (_character, _chat, value) => {
      note('setChatToIndex');
      state.onWrite?.(value, state);
      state.writes += 1;
      state.chat = structuredClone(value);
    },
    addRisuScriptHandler: async (mode, fn) => {
      note(`addRisuScriptHandler:${mode}`);
      state.handlers[mode] = fn;
    },
    removeRisuScriptHandler: async (mode, fn) => {
      note(`removeRisuScriptHandler:${mode}`);
      if (state.handlers[mode] === fn) delete state.handlers[mode];
    },
    addRisuReplacer: async (mode, fn) => {
      note(`addRisuReplacer:${mode}`);
      state.replacers[mode] = fn;
    },
    removeRisuReplacer: async (mode, fn) => {
      note(`removeRisuReplacer:${mode}`);
      if (state.replacers[mode] === fn) delete state.replacers[mode];
    },
    addRisuChatListener: async (mode, fn) => {
      note('addRisuChatListener');
      state.listeners.push(fn);
    },
    removeRisuChatListener: async (mode, fn) => {
      note('removeRisuChatListener');
      state.listeners = state.listeners.filter((one) => one !== fn);
    },
    requestPluginPermission: async (name) => (note(`requestPluginPermission:${name}`), permission),
    registerSetting: async () => (note('registerSetting'), state.uiParts.push('setting'), { id: 'setting' }),
    registerButton: async (arg) => (note('registerButton'), state.uiParts.push(arg.id), { id: arg.id || 'button' }),
    unregisterUIPart: async (id) => {
      note('unregisterUIPart');
      state.uiParts = state.uiParts.filter((one) => one !== id);
    },
    getRootDocument: async () => (note('getRootDocument'), dom ? dom.document : null),
    createMutationObserver: async () => ({ observe: async () => {}, disconnect: async () => {} }),
    unwarpSafeArray: async (value) => (Array.isArray(value) ? value : []),
    runLLMModel: async (request) => {
      note('runLLMModel');
      state.llmCalls.push(request);
      if (!llm) return { type: 'fail', result: 'no model' };
      return llm(request, state);
    },
    getCurrentLorebookEntries: async () => lorebook,
    getDatabase: async () => database,
    readImage: async () => null,
    nativeFetch: async () => ({ ok: true, text: async () => '//@name itemx2\n//@version 0.0.0\n' }),
    onUnload: async (fn) => {
      note('onUnload');
      state.unload = fn;
    },
    showContainer: async () => note('showContainer'),
    hideContainer: async () => note('hideContainer')
  };
  if (llm === false) delete api.runLLMModel;
  return { api, state, dom };
}

// Settles pending microtasks and short timers.
export const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

export function message(role, data, chatId) {
  return { role, data, chatId: chatId || `m-${Math.random().toString(36).slice(2, 10)}`, time: 0 };
}
