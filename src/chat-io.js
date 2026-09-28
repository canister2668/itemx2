/* Chat reads and guarded writes. Reading a chat must observe the host, which
 * runs outside our queue: keep immutable read provenance, never a cache of
 * mutable host state. */
import * as Store from './storage.js';
import { host } from './host.js';
import { fail, timed, timedSync, workQueue } from './kernel.js';

const chatReads = new WeakMap();

export const readChat = async (characterIndex, chatIndex, ...rest) => {
  const raw = await timed('host:readChat', () => host().getChatFromIndex(characterIndex, chatIndex, ...rest));
  const original = JSON.stringify(raw);
  const chat = timedSync('storage:hydrate', () => Store.hydrate(raw));
  if (chat) chatReads.set(chat, { characterIndex, chatIndex, original });
  return chat;
};

export const saveChat = async (characterIndex, chatIndex, chat, base = chat, { cleanup = false } = {}) => {
  workQueue.assertCurrent();
  const read = chatReads.get(base);
  if (!read || read.characterIndex !== characterIndex || read.chatIndex !== chatIndex)
    throw new Error('ITEMX write requires its original chat read');
  // Detach before the first await: persist intentionally shares message arrays.
  const detached = JSON.parse(JSON.stringify(chat));
  const persisted = cleanup ? detached : timedSync('storage:persist', () => Store.persist(detached));
  const latest = await timed('host:readChat', () => host().getChatFromIndex(characterIndex, chatIndex));
  workQueue.assertCurrent();
  if (JSON.stringify(latest) !== read.original)
    throw new Error('ITEMX chat changed before saving; retry the operation');
  // Stock API has no atomic compare-and-set. This rejects observed conflicts;
  // the host still owns the interval between the final read and whole-chat set.
  return timed('host:writeChat', () => host().setChatToIndex(characterIndex, chatIndex, persisted));
};

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
