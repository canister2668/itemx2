/* Settings store. One plugin-storage document: global preferences plus one
 * normalized record per character. Callers change settings only through the
 * commands below; each change is announced on the `settings` event. */
import { emit } from './events.js';
import { host } from './host.js';
import { setDebugEnabled } from './kernel.js';

export const KEY = 'itemx:settings';
export const BADGE_POSITION_KEYS = ['lb', 'lm', 'lt', 'rb', 'rm', 'rt'];
export const FX_MODES = ['full', 'lite', 'off'];
export const SKIN_MODES = ['dark', 'frost', 'hanji'];
export const AUX_MODES = ['off', 'missing', 'always'];
export const RARITY_MODES = ['world', 'itemx'];
export const FONT_SCALES = ['small', 'medium', 'large'];
export const CARD_FX_MODES = ['prism', 'classic'];
export const CURRENCY_DISPLAY_MODES = ['grid', 'both', 'wallet'];
export const DOMAIN_KEYS = { items: 'itemsEnabled', skills: 'skillsEnabled', encounters: 'encountersEnabled' };

export const schema = Object.freeze({
  enabled: true,
  mainOutput: true,
  auxOutput: AUX_MODES,
  rarityMode: RARITY_MODES,
  itemsEnabled: true,
  skillsEnabled: true,
  encountersEnabled: true,
  debugEnabled: false,
  effectsLevel: FX_MODES,
  fontScale: FONT_SCALES,
  moduleAssetsEnabled: false,
  lorebookEncounterEnabled: false,
  autoPruneEnabled: true,
  skin: SKIN_MODES,
  cardFx: CARD_FX_MODES,
  cardOpenLatest: false,
  currencyDisplay: CURRENCY_DISPLAY_MODES
});

export function normalize(value = {}) {
  return Object.fromEntries(
    Object.entries(schema).map(([key, rule]) => [
      key,
      Array.isArray(rule)
        ? rule.includes(value[key])
          ? value[key]
          : rule[0]
        : typeof value[key] === 'boolean'
          ? value[key]
          : rule
    ])
  );
}

async function readDocument() {
  const raw = await host().pluginStorage.getItem(KEY);
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (value == null) return { v: 1, global: { badgePosition: 'rm' }, characters: {} };
  if (value.v !== 1 || !value.global || !value.characters) throw new Error('Invalid ITEMX settings document');
  return value;
}

async function writeDocument(id, patch) {
  const doc = await readDocument();
  if (id == null) Object.assign(doc.global, patch);
  else doc.characters[id] = normalize({ ...doc.characters[id], ...patch });
  await host().pluginStorage.setItem(KEY, JSON.stringify(doc));
  return doc;
}

const cache = new Map();
let badgePosition = 'rm';

export const settingsId = (character) => character?.chaId || 'unknown';
export const cachedSettings = (character) => cache.get(settingsId(character));

// Settings for one character; read once, then served from memory.
export async function settingsFor(character, { refresh = false } = {}) {
  const id = settingsId(character);
  if (!refresh && cache.has(id)) return { ...cache.get(id) };
  const document = await readDocument();
  const settings = normalize(document.characters[id]);
  cache.set(id, settings);
  setDebugEnabled(settings.debugEnabled);
  await emit('settings', { character, settings: { ...settings }, patch: null });
  return { ...settings };
}

export async function isEnabled(character) {
  return (cachedSettings(character) || (await settingsFor(character))).enabled;
}

// The one write path. Validation belongs to the schema: an unknown value falls
// back to the field's default instead of being stored.
export async function changeSettings(character, patch) {
  const id = settingsId(character);
  const doc = await writeDocument(id, patch);
  const settings = doc.characters[id];
  cache.set(id, settings);
  if ('debugEnabled' in patch) setDebugEnabled(settings.debugEnabled);
  await emit('settings', { character, settings: { ...settings }, patch });
  return { ...settings };
}

export const badgePositionSetting = () => badgePosition;

export async function loadBadgePosition() {
  const saved = (await readDocument()).global.badgePosition;
  if (BADGE_POSITION_KEYS.includes(saved)) badgePosition = saved;
  return badgePosition;
}

export async function setBadgePosition(value) {
  if (!BADGE_POSITION_KEYS.includes(value)) throw new Error('Invalid ITEMX badge position');
  badgePosition = value;
  await writeDocument(null, { badgePosition: value });
}
