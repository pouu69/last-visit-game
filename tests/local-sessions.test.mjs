import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLocalSessions } from '../src/local-sessions.mjs';

const options = { timeout: 20_000 };
const prefix = 'museum-local-record-v1:';

function fixture() {
  const records = new Map();
  let counter = 0;
  let blocked = false;
  const storage = {
    getItem: (key) => records.get(key) ?? null,
    setItem(key, value) {
      if (blocked) throw new Error('Quota exceeded');
      records.set(key, value);
    },
  };
  return {
    storage,
    records,
    createId: () => (++counter).toString(16).padStart(48, '0'),
    block: () => {
      blocked = true;
    },
    unblock: () => {
      blocked = false;
    },
  };
}

function inspect(game, session) {
  return game.event(session.sessionId, {
    type: 'INSPECT',
    teamId: session.view.teamId,
    sceneId: session.view.sceneId,
    revision: session.view.revision,
    hotspotId: 'invitation',
  });
}

test('new games assign nicknames that survive progress, reload and file import', options, () => {
  const data = fixture();
  const game = createLocalSessions(data);
  const first = game.create(1);
  const second = game.create(1);
  const name = first.view.playerName;
  assert.match(name, /^[가-힣]{2,12}$/);
  // The fixture supplies different random-ID seeds without a probabilistic assertion.
  assert.notEqual(second.view.playerName, name);
  assert.equal(inspect(game, first).view.playerName, name);
  const reloaded = createLocalSessions(data);
  assert.equal(reloaded.get(first.sessionId).view.playerName, name);
  const exported = reloaded.save(first.sessionId).record;
  assert.equal(exported.playerName, name);
  const imported = reloaded.restore(null, exported);
  assert.notEqual(imported.sessionId, first.sessionId);
  assert.equal(imported.view.playerName, name);
  assert.throws(() => reloaded.restore(null, { ...exported, playerName: '바다' }), {
    code: 'CHECKSUM_MISMATCH',
  });
});

test(
  'browser records replay real progress, isolate teams and reject stale tab events',
  options,
  () => {
    const data = fixture();
    const game = createLocalSessions(data);
    const one = game.create(1);
    const two = game.create(2);
    const progressed = inspect(game, one);
    assert.equal(progressed.view.exploration.activeHotspot, 'invitation');
    assert.equal(progressed.view.revision, one.view.revision + 1);
    const reloaded = createLocalSessions(data);
    assert.deepEqual(reloaded.get(one.sessionId), progressed);
    assert.deepEqual(reloaded.get(two.sessionId).view, two.view);
    assert.throws(() => inspect(reloaded, one), { code: 'STALE_EVENT' });
    assert.deepEqual(reloaded.save(one.sessionId).record, game.save(one.sessionId).record);
    const before = data.records.get(prefix + two.sessionId);
    assert.throws(() => game.restore(two.sessionId, game.save(one.sessionId).record), {
      code: 'TEAM_MISMATCH',
    });
    assert.equal(data.records.get(prefix + two.sessionId), before);
  }
);

test(
  'import preserves a complete historical game and rejects corrupt replacements atomically',
  options,
  () => {
    const data = fixture();
    const game = createLocalSessions(data);
    const record = JSON.parse(
      readFileSync(
        new URL('../artifacts/full-play-complete-record.json', import.meta.url),
        'utf8'
      )
    );
    const restored = game.restore(null, record);
    assert.equal(restored.view.sceneId, 'E1');
    assert.equal(restored.view.phase, 'terminal');
    assert.equal(restored.view.history.length, 11);
    assert.deepEqual(game.save(restored.sessionId).record, record);
    const corrupt = { ...record, checksum: '0'.repeat(64) };
    const before = new Map(data.records);
    assert.throws(() => game.restore(null, corrupt), { code: 'CHECKSUM_MISMATCH' });
    assert.throws(() => game.restore(restored.sessionId, corrupt), {
      code: 'CHECKSUM_MISMATCH',
    });
    assert.deepEqual(data.records, before);
    data.records.set(prefix + restored.sessionId, '{broken');
    assert.throws(() => createLocalSessions(data).get(restored.sessionId), {
      code: 'INVALID_SAVE',
    });
  }
);

test(
  'storage failure keeps newer progress in memory and warns on every read and export',
  options,
  () => {
    const data = fixture();
    const game = createLocalSessions(data);
    const session = game.create(1);
    data.block();
    const progressed = inspect(game, session);
    assert.match(progressed.warning, /기록 내려받기/);
    assert.deepEqual(game.get(session.sessionId), progressed);
    const saved = game.save(session.sessionId);
    assert.equal(saved.warning, progressed.warning);
    assert.equal(saved.record.events.length, 1);
    assert.equal(JSON.parse(data.records.get(prefix + session.sessionId)).events.length, 0);
    const memory = createLocalSessions({ storage: null, createId: data.createId });
    const temporary = memory.create(2);
    assert.equal(memory.get(temporary.sessionId).warning, progressed.warning);
    assert.equal(memory.save(temporary.sessionId).warning, progressed.warning);
  }
);

// Regression: ../artifacts/static-migration.md#storage-conflict
test(
  'a tab with failed storage never overwrites another tab after storage recovers',
  options,
  () => {
    const data = fixture();
    const first = createLocalSessions(data);
    const session = first.create(1);
    data.block();
    const unsaved = inspect(first, session);
    data.unblock();
    const other = createLocalSessions(data);
    let latest = inspect(other, session);
    const next = (game, view) =>
      game.event(session.sessionId, {
        type: 'NEXT',
        teamId: view.teamId,
        sceneId: view.sceneId,
        revision: view.revision,
      });
    latest = next(other, latest.view);
    latest = next(other, latest.view);
    const disk = data.records.get(prefix + session.sessionId);
    const continued = next(first, unsaved.view);
    assert.equal(
      data.records.get(prefix + session.sessionId),
      disk,
      'Unsaved tab replaced the newer record'
    );
    assert.equal(continued.warning, unsaved.warning);
    assert.equal(first.save(session.sessionId).record.events.length, 2);
    assert.deepEqual(createLocalSessions(data).get(session.sessionId), latest);
  }
);
