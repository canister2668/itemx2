/* Chat reads and guarded writes. A read returns the host's own copy untouched:
 * no hydration, no clone, no serialization. Write provenance is computed only
 * when writing: the chat must still equal the copy the change was made from. */
import { host } from './host.js';
import { fail, timed, workQueue } from './kernel.js';

const reads = new WeakMap();

export async function readChat(characterIndex, chatIndex) {
  const chat = await timed('host:readChat', () => host().getChatFromIndex(characterIndex, chatIndex));
  if (chat && typeof chat === 'object') reads.set(chat, { characterIndex, chatIndex });
  return chat;
}

// Writes `next`, made from `base` (a chat this module read and nobody mutated).
// Stock API has no atomic compare-and-set: this rejects observed conflicts,
// and the host still owns the interval between the final read and the set.
export async function saveChat(characterIndex, chatIndex, next, base) {
  workQueue.assertCurrent();
  const read = reads.get(base);
  if (!read || read.characterIndex !== characterIndex || read.chatIndex !== chatIndex)
    throw new Error('ITEMX write requires its original chat read');
  // Detach before the first await: callers keep building on shared arrays.
  // Each message record is copied shallowly: its text strings are shared,
  // never re-serialized, yet a caller assigning a field later changes nothing.
  const written = {
    ...next,
    message: Array.isArray(next?.message)
      ? next.message.map((message) => (message && typeof message === 'object' ? { ...message } : message))
      : next?.message,
    scriptstate: next?.scriptstate && typeof next.scriptstate === 'object' ? { ...next.scriptstate } : next?.scriptstate
  };
  const latest = await timed('host:readChat', () => host().getChatFromIndex(characterIndex, chatIndex));
  workQueue.assertCurrent();
  if (!sameChat(latest, base)) throw new Error('ITEMX chat changed before saving; retry the operation');
  await timed('host:writeChat', () => host().setChatToIndex(characterIndex, chatIndex, written));
  reads.set(written, { characterIndex, chatIndex });
  return written;
}

// Whether the host's chat still equals the copy a change was made from. Same
// result as comparing serializations, without serializing a long chat twice:
// top-level fields and message fields compare by value, text by string
// equality (native, no copy), nested values by serialization only when the
// references differ.
const sameValue = (a, b) =>
  a === b || (typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));
// Keys a serialization would keep: undefined values vanish from JSON.
const definedKeys = (value) => Object.keys(value).filter((key) => value[key] !== undefined);
function sameRecord(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = definedKeys(a);
  if (keys.length !== definedKeys(b).length) return false;
  for (const key of keys) {
    if (b[key] === undefined) return false;
    if (!sameValue(a[key], b[key])) return false;
  }
  return true;
}
export function sameChat(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = definedKeys(a);
  if (keys.length !== definedKeys(b).length) return false;
  for (const key of keys) {
    if (b[key] === undefined) return false;
    if (key === 'message') {
      const left = a.message,
        right = b.message;
      if (!Array.isArray(left) || !Array.isArray(right)) {
        if (!sameValue(left, right)) return false;
        continue;
      }
      if (left.length !== right.length) return false;
      for (let index = 0; index < left.length; index += 1) if (!sameRecord(left[index], right[index])) return false;
    } else if (key === 'scriptstate') {
      if (!sameRecord(a.scriptstate, b.scriptstate)) return false;
    } else if (!sameValue(a[key], b[key])) return false;
  }
  return true;
}

export const chatIsStreaming = (chat) =>
  Boolean(chat?.isStreaming || (chat?.message || []).some((message) => message?.isStreaming || message?.bgContinue));

export async function context() {
  try {
    const [characterIndex, chatIndex, character] = await Promise.all([
      host().getCurrentCharacterIndex(),
      host().getCurrentChatIndex(),
      host().getCharacter()
    ]);
    if (characterIndex == null || chatIndex == null || !character) return null;
    const chat = await readChat(characterIndex, chatIndex);
    if (!chat) return null;
    return {
      characterIndex,
      chatIndex,
      character,
      chat,
      key: `${character.chaId || characterIndex}:${chat.id || chatIndex}`
    };
  } catch (error) {
    // PocketRisu has no current chatPage on Home. A globally loaded plugin
    // must treat that route as an idle state, not as an initialization error.
    if (!/chatPage|current chat|undefined/i.test(String(error?.message || error))) fail('active chat context', error);
    return null;
  }
}
