import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeriesTransition } from '../public/series-transition.mjs';

function advance(t, seconds = 5) { for (let i = 0; i < seconds * 20; i++) t.tick(0.05); }
test('episode handoff waits for assets and commits once while fully covered and locked', async () => {
  let ready, commits = 0, locked = false, cover = 0;
  const t = createSeriesTransition({ prepare: () => new Promise(resolve => ready = resolve),
    commit: () => { assert.equal(locked, true); assert.equal(cover, 1); commits++; },
    onFrame: f => cover = f.cover, onLock: value => locked = value });
  assert.equal(t.start(2, 4), true);
  assert.equal(t.start(2, 3), false);
  advance(t); assert.equal(t.status, 'loading'); assert.equal(commits, 0);
  ready({}); await Promise.resolve(); advance(t);
  assert.equal(commits, 1); assert.equal(locked, false); assert.equal(t.status, 'idle');
});
test('late loaded resources are disposed after cancellation and never committed', async () => {
  let ready, disposed = 0;
  const t = createSeriesTransition({ prepare: () => new Promise(resolve => ready = resolve), commit: () => assert.fail() });
  t.start(1, 2); t.cancel(); ready({ dispose: () => disposed++ }); await Promise.resolve();
  advance(t); assert.equal(disposed, 1); assert.equal(t.status, 'idle');
});
test('preloaded destination is also committed only after full cover', async () => {
  let cover = 0, commits = 0;
  const t = createSeriesTransition({ prepare: async () => ({}), onFrame: f => cover = f.cover,
    commit: () => { assert.equal(cover, 1); commits++; } });
  t.start(4, 2); await Promise.resolve(); advance(t);
  assert.equal(commits, 1);
});
test('loading failure preserves retry and unlocks only after successful arrival', async () => {
  let attempts = 0, errors = 0, commits = 0, locked;
  const t = createSeriesTransition({ prepare: async () => { if (++attempts === 1) throw Error('offline'); return {}; },
    commit: () => commits++, onError: () => errors++, onLock: v => locked = v, reducedMotion: true });
  t.start(3, 5); await Promise.resolve();
  assert.equal(t.status, 'failed'); assert.equal(locked, true); assert.equal(errors, 1);
  t.retry(); await Promise.resolve(); advance(t);
  assert.equal(commits, 1); assert.equal(locked, false);
});
