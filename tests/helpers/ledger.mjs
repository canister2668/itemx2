/* Builds chats the way ITEMX 2.4 stores them: anchors in message text, events
 * in the ledger document. */
import * as Core from '../../src/engine/core.js';
import * as Codex from '../../src/engine/codex.js';
import { DOCUMENT_KEY, emptyDocument, readDocument } from '../../src/store/document.js';
import { allocateKey, anchor } from '../../src/store/anchors.js';
import { fold } from '../../src/store/replay.js';
import { activeContextKey, addPending } from '../../src/session.js';

let counter = 0;
const nextKey = () => `k${(counter++).toString(36).padStart(4, '0')}`;

export const itemExam = (item) => ({ kind: 'exam', item: Core.normalizeItem(item).item });

// Events parsed from model tags, as the output hook would see them.
export function eventsFrom(text) {
  const items = Core.extractResponse(text);
  const codex = Codex.extractResponse(items.content, Codex.snapshot(), { enabledDomains: ['skill', 'monster'] });
  return [...items.events, ...codex.events];
}

// messages: [{ role, data, chatId?, events?: [event] }]. Each event gets an
// anchor appended to its message and a row in the document.
export function seedChat(messages, { doc = emptyDocument(), scriptstate = {}, extra = {} } = {}) {
  const out = messages.map((message, index) => {
    const chatId = message.chatId ?? `m${index}`;
    let data = message.data ?? '';
    for (const event of message.events || []) {
      const key = message.keys?.shift() || nextKey();
      doc.seq += 1;
      doc.events[key] = { c: chatId, d: event.domain ? 'codex' : 'item', e: event, s: doc.seq };
      data = `${data}\n\n${anchor(key)}`;
    }
    const rest = { ...message };
    delete rest.events;
    delete rest.keys;
    return { role: 'char', ...rest, chatId, data };
  });
  return { message: out, scriptstate: { ...scriptstate, [DOCUMENT_KEY]: JSON.stringify(doc) }, ...extra };
}

export const documentOf = (chat) => readDocument(chat);

// A chat written with full transport markers (the shape parsers produce),
// converted to anchors and a document: the fixture style of older tests.
export function anchored(chat) {
  const doc = chat?.scriptstate?.[DOCUMENT_KEY] ? readDocument(chat) : emptyDocument();
  const message = (chat.message || []).map((one, index) => {
    let ordinal = 0;
    const field = typeof one?.data === 'string' ? 'data' : typeof one?.content === 'string' ? 'content' : '';
    if (!field) return one;
    const text = one[field].replace(/<!--(ITEMX2|CODEX2):([A-Za-z0-9_-]+)-->/g, (_, prefix, code) => {
      const payload = (prefix === 'ITEMX2' ? Core : Codex).decodePayload(code);
      if (!payload?.event) return '';
      // Deterministic, so converting the same fixture twice agrees on its keys.
      const key = allocateKey(`${one.chatId ?? index}|${ordinal++}|${code}`, (candidate) => candidate in doc.events);
      doc.seq += 1;
      doc.events[key] = {
        c: typeof one.chatId === 'string' ? one.chatId : '',
        d: prefix === 'ITEMX2' ? 'item' : 'codex',
        e: payload.event,
        ...(payload.review ? { r: payload.review } : {}),
        s: doc.seq
      };
      return anchor(key);
    });
    return text === one[field] ? one : { ...one, [field]: text };
  });
  return { ...chat, message, scriptstate: { ...(chat.scriptstate || {}), [DOCUMENT_KEY]: JSON.stringify(doc) } };
}

// An anchor whose card is a pending (parsed, not yet committed) record, as
// during a response: the display hook resolves it without any document.
export function pendingAnchor(payload, { chatKey = activeContextKey(), domain = null } = {}) {
  const key = `p${(counter++).toString(36).padStart(4, '0')}`;
  addPending(key, { ...payload, domain: domain || (payload.event?.domain ? 'codex' : 'item'), chatKey });
  return anchor(key);
}

// Replays messages written with transport markers, through anchors and the
// document, as the runtime would: { registry, skills, monsters, ... }.
export function replay(messages) {
  const chat = anchored({ message: messages, scriptstate: {} });
  const state = fold(chat, readDocument(chat));
  return { ...state.codex, registry: state.item.registry };
}

// Installs our stylesheet in a fake host document, as a real session has it;
// without it the display hook falls back to compact chips.
export async function withMainStyle(fake) {
  const Style = await import('../../src/ui/style.js');
  const { setHost } = await import('../../src/host.js');
  await Style.removeMainStyle();
  setHost(fake.api);
  await Style.installMainStyle();
}
