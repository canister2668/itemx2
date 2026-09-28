/* Cooperative scheduler with two lanes. The commit lane owns chat and ledger
 * writes; the view lane owns drawer and host-DOM work. Each lane runs one job
 * at a time and the lanes run independently, so a drawer refresh never waits
 * behind a model call. Model RPCs yield their lane because the host can
 * re-enter our request/output hooks. */
const LANES = ['commit', 'view'];
// Timers whose work only touches the drawer or host DOM.
const VIEW_TIMERS = /^(?:host(?:Light)?SyncTimer|remountTimer|feedbackTimer|auxToastTimer|resumeTimer|burst:)/;
const laneOf = (intent) => (intent.lane === 'view' ? 'view' : 'commit');

function create({ clock = () => Date.now() } = {}) {
  const pending = new Map(),
    jobs = new Set(),
    timers = new Map(),
    records = new Map();
  const active = { commit: null, view: null };
  let closed = false,
    sequence = 0;
  const aborted = () => Object.assign(new Error('ITEMX task cancelled'), { name: 'AbortError' });
  function pumpLane(lane) {
    if (active[lane] || closed) return;
    const suspended = [...jobs].some((job) => job.lane === lane && job.phase === 'external' && !job.cancelled);
    const first = [...pending.entries()]
      .filter(
        ([, job]) =>
          job.lane === lane &&
          (!job.intent.ready || job.intent.ready()) &&
          (!suspended || job.resume || job.intent.reentrant)
      )
      .values()
      .next();
    if (first.done) return;
    const [key, job] = first.value;
    pending.delete(key);
    active[lane] = job;
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
        if (active[lane] === job) active[lane] = null;
        pumpLane(lane);
      });
  }
  function pump() {
    for (const lane of LANES) pumpLane(lane);
  }
  // The job whose code is running: the commit lane's unless only the view
  // lane is busy. Used for cancellation checks and stage labels.
  const current = () => active.commit || active.view;
  function enqueue(intent) {
    if (closed) return Promise.resolve(undefined);
    const key = intent.unique ? `${intent.kind}:${++sequence}` : `${intent.kind}:${intent.key || ''}`;
    const existing = pending.get(key);
    if (existing && !existing.resume) {
      existing.intent = intent; // Keep its FIFO position and all waiting callers.
      return existing.promise;
    }
    const job = { key, intent, lane: laneOf(intent), cancelled: false, resume: null };
    job.promise = new Promise((resolve, reject) => Object.assign(job, { resolve, reject }));
    jobs.add(job);
    pending.set(key, job);
    pump();
    return job.promise;
  }
  // Only commit-lane work calls the model or other long host RPCs; view jobs
  // never yield (a view job calling this simply runs `work`).
  async function external(work) {
    const owner = active.commit;
    if (!owner) return work();
    owner.phase = 'external';
    active[owner.lane] = null;
    pumpLane(owner.lane);
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
      pumpLane(owner.lane);
    });
    if (owner.cancelled) throw aborted();
    if (error) throw error;
    return result;
  }
  function cancel(predicate = () => true, includeActive = true) {
    const running = (job) => active[job.lane] === job;
    for (const job of jobs)
      if ((includeActive || !running(job)) && predicate(job.intent)) {
        job.cancelled = true;
        if (!running(job)) {
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
      return enqueue({ kind: key, work, ready, lane: VIEW_TIMERS.test(key) ? 'view' : 'commit' }).catch(() => {});
    };
    const id = (repeat ? setInterval : setTimeout)(callback, ms);
    timers.set(key, { id, ms, repeat });
    return id;
  }
  // Completed work is keyed by semantic identity, independently of in-flight
  // coalescing. A failed attempt never becomes a successful deduplication key.
  function revision(kind) {
    return records.get(kind)?.key ?? '';
  }
  function remember(kind, key) {
    records.set(kind, { key, at: clock() });
    return key;
  }
  function forget(kind) {
    records.delete(kind);
  }
  function settled(kind, key, ms) {
    const previous = records.get(kind);
    if (previous?.key !== key) {
      records.set(kind, { key, since: clock() });
      return false;
    }
    return clock() - previous.since >= ms;
  }
  // `accept(value)` decides: true settles the key, 'retry' leaves it open for a
  // short while without counting a failure, anything else (or a throw) counts
  // one failure and backs off exponentially.
  async function attempt(kind, key, work, accept = () => true, ttl = Infinity, giveUpAfter = Infinity) {
    const previous = records.get(kind);
    if (previous?.key === key && previous.failures >= giveUpAfter) return { skipped: true, exhausted: true };
    if (previous?.key === key && ((previous.done && clock() - previous.at < ttl) || clock() < previous.retryAt))
      return { skipped: true };
    let value, error;
    try {
      value = await work();
    } catch (caught) {
      error = caught;
    }
    const verdict = error ? false : accept(value);
    const prior = previous?.key === key ? previous.failures || 0 : 0;
    const failures = verdict === true || verdict === 'retry' ? prior : Math.min(prior + 1, 6);
    const failed = verdict !== true && verdict !== 'retry';
    records.set(kind, {
      key,
      at: clock(),
      done: verdict === true,
      failures: verdict === true ? 0 : failures,
      retryAt: failed ? clock() + Math.min(120000, 5000 * 2 ** failures) : verdict === 'retry' ? clock() + 5000 : 0
    });
    if (error) throw error;
    return { skipped: false, value };
  }
  function close() {
    const completion = Promise.allSettled([...jobs].map((job) => job.promise));
    closed = true;
    for (const key of timers.keys()) clearTimer(key);
    cancel();
    records.clear();
    return completion;
  }
  return {
    enqueue,
    revision,
    remember,
    forget,
    settled,
    attempt,
    recent: (kind, age) => (clock() - (records.get(kind)?.at ?? -Infinity) < age ? records.get(kind)?.key : null),
    wake: pump,
    external,
    cancel,
    close,
    schedule,
    clearTimer,
    hasTimer: (key) => timers.has(key),
    age: (kind) => clock() - (records.get(kind)?.at ?? -Infinity),
    later(group, work, ms) {
      return schedule(`${group}:${++sequence}`, work, ms);
    },
    clearGroup(group) {
      for (const key of timers.keys()) if (key.startsWith(`${group}:`)) clearTimer(key);
    },
    isActive: (kind) => [...jobs].some((job) => !job.cancelled && (job.intent.kind === kind || job.stage === kind)),
    stage(kind) {
      const owner = current(),
        previous = owner?.stage;
      if (owner) owner.stage = kind;
      return () => {
        if (owner) owner.stage = previous;
      };
    },
    // Only close() cancels running jobs, and it cancels all of them.
    assertCurrent() {
      if (closed || current()?.cancelled) throw aborted();
    },
    get size() {
      return jobs.size;
    }
  };
}

export { create };
