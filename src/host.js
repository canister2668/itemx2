/* Host adapter. The only module that names the RisuAI plugin API global; tests
 * install a fake with setHost(). */
let api = globalThis.Risuai ?? null;

export function setHost(value) {
  api = value;
}

export function host() {
  if (!api) throw new Error('RisuAI plugin API unavailable');
  return api;
}
