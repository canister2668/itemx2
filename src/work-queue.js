/* One cooperative scheduler. Only the owner may mutate runtime state. Model
 * RPCs yield ownership because the host can re-enter our request/output hooks. */
const ITEMXWorkQueue = (() => {
  function create() {
    const pending = new Map(),
      jobs = new Set(),
      timers = new Map(),
      records = new Map();
    let active = null,
      closed = false,
      sequence = 0;
    const aborted = () => Object.assign(new Error('ITEMX task cancelled'), { name: 'AbortError' });
    function pump() {
      if (active || closed) return;
      const suspended = [...jobs].some((job) => job.phase === 'external' && !job.cancelled);
      const first = [...pending.entries()]
        .filter(([, job]) => (!job.intent.ready || job.intent.ready()) && (!suspended || job.resume || job.intent.reentrant))
        .values()
        .next();
      if (first.done) return;
      const [key, job] = first.value;
      pending.delete(key);
      active = job;
      job.phase = 'running';
      if (job.resume) {
        const resume = job.resume;
        job.resume = null;
        resume();
        return;
      }
      Promise.resolve()
        .then(() => {
          if (job.cancelled) throw aborted();
          return job.intent.work(job);
        })
        .then(job.resolve, job.reject)
        .finally(() => {
          jobs.delete(job);
          if (active === job) active = null;
          pump();
        });
    }
    function enqueue(intent) {
      if (closed) return Promise.resolve(undefined);
      const key = intent.unique ? `${intent.kind}:${++sequence}` : `${intent.kind}:${intent.key || ''}`;
      const existing = pending.get(key);
      if (existing && !existing.resume) {
        existing.intent = intent; // Keep its FIFO position and all waiting callers.
        return existing.promise;
      }
      const job = { key, intent, cancelled: false, resume: null };
      job.promise = new Promise((resolve, reject) => Object.assign(job, { resolve, reject }));
      jobs.add(job);
      pending.set(key, job);
      pump();
      return job.promise;
    }
    async function external(work) {
      const owner = active;
      if (!owner) return work();
      owner.phase = 'external';
      active = null;
      pump();
      let result, error;
      try {
        result = await work();
      } catch (caught) {
        error = caught;
      }
      if (closed || owner.cancelled) throw aborted();
      await new Promise((resolve) => {
        owner.resume = resolve;
        // Resume slots are never coalesced with new intents of the same kind.
        pending.set(`resume:${++sequence}`, owner);
        pump();
      });
      if (owner.cancelled) throw aborted();
      if (error) throw error;
      return result;
    }
    function cancel(predicate = () => true, includeActive = true) {
      for (const job of jobs)
        if ((includeActive || job !== active) && predicate(job.intent)) {
          job.cancelled = true;
          if (job !== active) {
            for (const [key, value] of pending) if (value === job) pending.delete(key);
            if (job.resume) job.resume();
            job.reject(aborted());
            jobs.delete(job);
          }
        }
    }
    function clearTimer(key) {
      const row = timers.get(key);
      if (!row) return;
      (row.repeat ? clearInterval : clearTimeout)(row.id);
      timers.delete(key);
    }
    function schedule(key, work, ms, repeat = false, ready = null) {
      if (closed) return;
      const row = timers.get(key);
      if (repeat && row?.repeat && row.ms === ms) return row.id;
      clearTimer(key);
      const callback = () => {
        if (!repeat) timers.delete(key);
        return enqueue({ kind: key, work, ready, reentrant: ['bodyFxStartTimer', 'bodyFxScrollTimer'].includes(key) }).catch(() => {});
      };
      const id = (repeat ? setInterval : setTimeout)(callback, ms);
      timers.set(key, { id, ms, repeat });
      return id;
    }
    // Completed work is keyed by semantic identity, independently of in-flight
    // coalescing. A failed attempt never becomes a successful deduplication key.
    function revision(kind) { return records.get(kind)?.key ?? ''; }
    function remember(kind, key) { records.set(kind, { key, at: Date.now() }); return key; }
    function forget(kind) { records.delete(kind); }
    function settled(kind, key, ms) {
      const previous = records.get(kind);
      if (previous?.key !== key) {
        records.set(kind, { key, since: Date.now() });
        return false;
      }
      return Date.now() - previous.since >= ms;
    }
    async function attempt(kind, key, work, accept = () => true, ttl = Infinity, giveUpAfter = Infinity) {
      const previous = records.get(kind);
      if (previous?.key === key && previous.failures >= giveUpAfter) return { skipped: true, exhausted: true };
      if (previous?.key === key && ((previous.done && Date.now() - previous.at < ttl) || Date.now() < previous.retryAt)) return { skipped: true };
      let value, error;
      try { value = await work(); } catch (caught) { error = caught; }
      const failures = !error && accept(value) ? 0 : Math.min((previous?.key === key ? previous.failures || 0 : 0) + 1, 6);
      records.set(kind, { key, at: Date.now(), done: failures === 0, failures, retryAt: failures ? Date.now() + Math.min(120000, 5000 * 2 ** failures) : 0 });
      if (error) throw error;
      return { skipped: false, value };
    }
    function close() {
      const completion = Promise.allSettled([...jobs].map(job => job.promise));
      closed = true;
      for (const key of timers.keys()) clearTimer(key);
      cancel();
      records.clear();
      return completion;
    }
    return {
      enqueue,
      revision, remember, forget, settled, attempt,
      recent: (kind, age) => Date.now() - (records.get(kind)?.at ?? -Infinity) < age ? records.get(kind)?.key : null,
      wake: pump,
      external,
      cancel,
      close,
      schedule,
      clearTimer,
      hasTimer: (key) => timers.has(key),
      age: kind => Date.now() - (records.get(kind)?.at ?? -Infinity),
      later(group, work, ms) { return schedule(`${group}:${++sequence}`, work, ms); },
      clearGroup(group) { for (const key of timers.keys()) if (key.startsWith(`${group}:`)) clearTimer(key); },
      isActive: kind => [...jobs].some(job => !job.cancelled && (job.intent.kind === kind || job.stage === kind)),
      stage(kind) {
        const owner = active, previous = owner?.stage;
        if (owner) owner.stage = kind;
        return () => { if (owner) owner.stage = previous; };
      },
      assertCurrent() {
        if (closed || active?.cancelled) throw aborted();
      },
      // Identity of our current job, not a lock on host-owned chat state.
      get token() {
        return active;
      },
      get size() {
        return jobs.size;
      }
    };
  }
  return { create };
})();
