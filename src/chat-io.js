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
  const written = JSON.parse(JSON.stringify(next));
  const expected = JSON.stringify(base);
  const latest = await timed('host:readChat', () => host().getChatFromIndex(characterIndex, chatIndex));
  workQueue.assertCurrent();
  if (JSON.stringify(latest) !== expected) throw new Error('ITEMX chat changed before saving; retry the operation');
  await timed('host:writeChat', () => host().setChatToIndex(characterIndex, chatIndex, written));
  reads.set(written, { characterIndex, chatIndex });
  return written;
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
