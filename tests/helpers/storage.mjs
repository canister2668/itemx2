import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sandbox = vm.createContext({ TextEncoder, TextDecoder, Buffer });
for (const file of ['core', 'codex', 'history', 'storage', 'settings-store']) vm.runInContext(readFileSync(new URL(`../../src/${file}.js`, import.meta.url), 'utf8'), sandbox);
export const storageModel = vm.runInContext('ITEMXStorage', sandbox);
export const settingsModel = vm.runInContext('ITEMXSettings', sandbox);
export const hydrate = chat => storageModel.hydrate(chat);
export const migrate = chat => storageModel.persist(chat, { legacy: true });
