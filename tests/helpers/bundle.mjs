/* Runs the built bundle in an isolated context against a fake host. Each call
 * is a fresh plugin instance: its own queue, stores and hooks. */
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

let source = null;

export async function loadBundle(api, globals = {}) {
  source ??= await readFile(new URL('../../dist/itemx2.plugin.js', import.meta.url), 'utf8');
  const sandbox = vm.createContext({
    console,
    TextEncoder,
    TextDecoder,
    structuredClone,
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval: () => {},
    btoa,
    atob,
    performance,
    Risuai: api,
    ...globals
  });
  vm.runInContext(source, sandbox);
  return sandbox;
}
