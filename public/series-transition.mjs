/** One owner for input, camera, loading and the durable episode boundary.
 * tick is driven by the world's animation loop, never by a second animation loop.
 * prepare must not mutate the active world; commit swaps only prepared resources.
 */
export const TRANSITION_STYLES = Object.freeze({
  1: { kind: 'dawn', title: '그 다음 날, 새로운 초대', departure: 1.6, arrival: 1.8 },
  2: { kind: 'walk', title: '화물실 뒤뜰에서 이어지는 길', departure: 1.5, arrival: 1.4 },
  3: { kind: 'curtain', title: '객석을 지나, 다음 약속으로', departure: 1.3, arrival: 1.7 },
  4: { kind: 'door', title: '출고문 밖에서 확인하는 다음 길', departure: 1.5, arrival: 1.6 },
});

export function createSeriesTransition({ prepare, commit, onFrame = () => {}, onLock = () => {}, onError = () => {}, reducedMotion = false }) {
  let active = null;
  let disposed = false;
  let serial = 0;
  function frame() {
    const a = active;
    if (!a) return;
    const duration = reducedMotion ? 0.15 : a.style[a.phase === 'departing' ? 'departure' : 'arrival'];
    const progress = a.phase === 'loading' || a.phase === 'failed' ? 1 : Math.min(1, a.elapsed / duration);
    const eased = progress * progress * (3 - 2 * progress);
    onFrame({ from: a.from, to: a.to, style: a.style.kind, title: a.style.title, phase: a.phase,
      progress, cover: a.phase === 'arriving' ? 1 - eased : eased, reducedMotion });
  }
  function fail(error, id) {
    if (disposed || active?.id !== id) return;
    active.phase = 'failed';
    active.error = error;
    frame();
    // Keep the scene locked under the error panel until retry or cancel.
    onError(error);
  }
  async function load(a) {
    try {
      const prepared = await prepare(a.to);
      if (disposed || active?.id !== a.id) { prepared?.dispose?.(); return; }
      a.prepared = prepared;
      a.ready = true;
    } catch (error) { fail(error, a.id); }
  }
  function cancel() {
    if (!active) return;
    active.prepared?.dispose?.();
    active = null;
    onFrame({ phase: 'idle', cover: 0 });
    onLock(false);
  }
  return {
    start(from, to) {
      if (disposed || active) return false;
      if (!TRANSITION_STYLES[from] || ![2, 3, 4, 5].includes(to) || from === to)
        throw new RangeError('Invalid episode transition');
      active = { id: ++serial, from, to, style: TRANSITION_STYLES[from], phase: 'departing', elapsed: 0, ready: false };
      onLock(true);
      frame();
      void load(active);
      return true;
    },
    tick(delta) {
      const a = active;
      if (!a || disposed || a.phase === 'failed') return;
      if (!Number.isFinite(delta) || delta < 0) return;
      // Returning from a background tab must not jump past the whole handoff.
      a.elapsed += Math.min(delta, 0.1);
      const departure = reducedMotion ? 0.15 : a.style.departure;
      const arrival = reducedMotion ? 0.15 : a.style.arrival;
      if (a.phase === 'departing' && a.elapsed >= departure) { a.phase = 'loading'; a.elapsed = 0; frame(); }
      if (a.phase === 'loading' && a.ready) {
        try {
          // Persist and swap synchronously at full cover, exactly once.
          commit(a.to, a.prepared);
          a.prepared = null;
          a.phase = 'arriving';
          a.elapsed = 0;
        } catch (error) { fail(error, a.id); return; }
      }
      frame();
      if (a.phase === 'arriving' && a.elapsed >= arrival) {
        active = null;
        onFrame({ phase: 'idle', cover: 0 });
        onLock(false);
      }
    },
    retry() {
      if (active?.phase !== 'failed') return false;
      const { from, to } = active;
      cancel();
      return this.start(from, to);
    },
    cancel,
    dispose() { cancel(); disposed = true; },
    get status() { return active?.phase ?? 'idle'; },
  };
}
