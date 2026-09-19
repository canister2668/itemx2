import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { runtimeSource } from '../scripts/runtime-source.mjs';

const source = await runtimeSource();
const queueSource = await readFile(new URL('../src/work-queue.js', import.meta.url), 'utf8');

// The host can change between any reads, including within a queue job.
function harness() {
  const calls = { read: 0, write: 0 };
  const chats = new Map();
  const slice = (start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `missing ${start}`);
    return source.slice(from, to);
  };
  const prelude = `${queueSource}
const workQueue = ITEMXWorkQueue.create();
const phaseStats = new Map();
const now = () => Date.now();
const mark = () => {};
const phaseCount = (p) => { phaseStats.set(p, (phaseStats.get(p) || 0) + 1); };
const timed = async (p, work) => work();
const timedSync = (p, work) => work();
const ITEMXStorage = { hydrate: (c) => c, persist: (c) => c };
`;
  const code =
    prelude +
    slice('  // Reading a chat', '  const stateOwners =') +
    `
const saveChatFn = saveChat;
globalThis.api = { readChat, saveChat: saveChatFn, workQueue, phaseStats };
`;
  const sandbox = {
    setTimeout, clearTimeout, setInterval, clearInterval,
    Risuai: {
      getChatFromIndex: async (c, i) => { calls.read += 1; return structuredClone(chats.get(`${c}:${i}`) || { id: `${c}:${i}`, message: [], scriptstate: {} }); },
      setChatToIndex: async (c, i, chat) => { calls.write += 1; chats.set(`${c}:${i}`, structuredClone(chat)); }
    }
  };
  vm.runInNewContext(code, sandbox);
  return { api: sandbox.api, calls };
}

test('repeat reads inside one job each observe the host', async () => {
  const { api, calls } = harness();
  await api.workQueue.enqueue({
    kind: 'turn',
    work: async () => {
      const a = await api.readChat(0, 0);
      const b = await api.readChat(0, 0);
      const c = await api.readChat(0, 0);
      assert.notEqual(a, b);
      assert.notEqual(b, c);
    }
  });
  assert.equal(calls.read, 3, 'host changes are not serialized by our queue');
  assert.equal(api.phaseStats.get('host:readChat:reused'), undefined);
});

test('a different chat in the same job is fetched separately', async () => {
  const { api, calls } = harness();
  await api.workQueue.enqueue({
    kind: 'turn',
    work: async () => {
      await api.readChat(0, 0);
      await api.readChat(0, 1);
      await api.readChat(0, 0);
    }
  });
  assert.equal(calls.read, 3, 'switching chats must not serve a stale entry');
});

test('a later job never reuses an earlier job\'s read', async () => {
  const { api, calls } = harness();
  await api.workQueue.enqueue({ kind: 'a', work: () => api.readChat(0, 0) });
  await api.workQueue.enqueue({ kind: 'b', work: () => api.readChat(0, 0) });
  assert.equal(calls.read, 2, 'the chat can change between jobs');
});

test('a read outside any job is never served from the cache', async () => {
  const { api, calls } = harness();
  await api.readChat(0, 0);
  await api.readChat(0, 0);
  assert.equal(calls.read, 2);
});

test('a write is verified and subsequent reads fetch committed host state', async () => {
  const { api, calls } = harness();
  await api.workQueue.enqueue({
    kind: 'turn',
    work: async () => {
      const chat = await api.readChat(0, 0);
      chat.message.push({ chatId: 'm1', role: 'char', data: '새 카드' });
      await api.saveChat(0, 0, chat);
      const after = await api.readChat(0, 0);
      assert.equal(after.message.length, 1, 'the read sees what was just written');
    }
  });
  assert.equal(calls.read, 3, 'read, conflict check, then fresh read');
  assert.equal(calls.write, 1);
});
