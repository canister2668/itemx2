import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { runtimeSource } from '../scripts/runtime-source.mjs';

const source = await runtimeSource();
const queueSource = await readFile(new URL('../src/work-queue.js', import.meta.url), 'utf8');

// Reading a chat marshals every message across the host bridge. Within one queue
// job nothing else can run, so the first read must serve the rest of that job.
function harness() {
  const calls = { read: 0, write: 0 };
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
    slice('  let chatCache = null;', '  const stateOwners =') +
    `
const saveChatFn = saveChat;
globalThis.api = { readChat, saveChat: saveChatFn, workQueue, phaseStats };
`;
  const sandbox = {
    setTimeout, clearTimeout, setInterval, clearInterval,
    Risuai: {
      getChatFromIndex: async (c, i) => { calls.read += 1; return { id: `${c}:${i}`, message: [], scriptstate: {} }; },
      setChatToIndex: async () => { calls.write += 1; }
    }
  };
  vm.runInNewContext(code, sandbox);
  return { api: sandbox.api, calls };
}

test('repeat reads inside one job cost one host round-trip', async () => {
  const { api, calls } = harness();
  await api.workQueue.enqueue({
    kind: 'turn',
    work: async () => {
      const a = await api.readChat(0, 0);
      const b = await api.readChat(0, 0);
      const c = await api.readChat(0, 0);
      assert.equal(a, b);
      assert.equal(b, c);
    }
  });
  assert.equal(calls.read, 1, 'three reads in one job must fetch once');
  assert.equal(api.phaseStats.get('host:readChat:reused'), 2);
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

test('a write seeds the entry so the next read does not fetch it back', async () => {
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
  assert.equal(calls.read, 1, 'writing then reading must not round-trip twice');
  assert.equal(calls.write, 1);
});
