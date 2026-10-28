import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dispatch, publicView, saveGame, restoreGame } from '../src/playbook.mjs';
import { sha256 } from '../src/hash.mjs';

function send(state, type, fields = {}) {
  const result = dispatch(state, {
    type, teamId: state.teamId, sceneId: state.sceneId, revision: state.revision, ...fields,
  });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.state;
}

function read(state) {
  while (publicView(state).canNext) state = send(state, 'NEXT');
  return state;
}

function scene() {
  return read(createGame(1, { mode: 'investigation' }).state);
}

test('old inspection events retain the complete pre-resume state byte for byte', () => {
  let state = scene();
  for (const [type, fields] of [
    ['INSPECT', { hotspotId: 'case' }], ['NEXT'], ['EXPLORE'],
    ['INSPECT', { hotspotId: 'trail' }], ['NEXT'], ['EXPLORE'],
    ['INSPECT', { hotspotId: 'case' }], ['NEXT'],
  ]) state = send(state, type, fields);
  assert.equal(sha256(JSON.stringify(state)),
    'aba3fe27ab796fdb2c7ed702a07ab3f49a1c1cdc25e7ce050a3f37e6933bec8a');
  assert.deepEqual(restoreGame(saveGame(state).record).state, state);
  // Captured from the previous runner, before the optional resume fields existed.
  const previousRecord = {
    version: 1, storyVersion: 'museum-play-2', teamId: 1,
    events: [
      { type: 'NEXT', teamId: 1, sceneId: 'S01', revision: 0 },
      { type: 'INSPECT', teamId: 1, sceneId: 'S01', revision: 1, hotspotId: 'case' },
      { type: 'NEXT', teamId: 1, sceneId: 'S01', revision: 2 },
      { type: 'EXPLORE', teamId: 1, sceneId: 'S01', revision: 3 },
      { type: 'INSPECT', teamId: 1, sceneId: 'S01', revision: 4, hotspotId: 'trail' },
      { type: 'NEXT', teamId: 1, sceneId: 'S01', revision: 5 },
      { type: 'EXPLORE', teamId: 1, sceneId: 'S01', revision: 6 },
      { type: 'INSPECT', teamId: 1, sceneId: 'S01', revision: 7, hotspotId: 'case' },
      { type: 'NEXT', teamId: 1, sceneId: 'S01', revision: 8 },
    ],
    checksum: '9ae499d3d7f680656deb2cb9f7c691db33f680844d05d11a2ee7ae8ea5f5fb28',
  };
  const restored = restoreGame(previousRecord);
  assert.equal(restored.ok, true, JSON.stringify(restored.error));
  assert.deepEqual(restored.state, state);
});

test('closing an unfinished inspection resumes its displayed line without replaying or revealing lines', () => {
  let state = send(send(scene(), 'INSPECT', { hotspotId: 'case', resume: true }), 'NEXT');
  const position = state.position;
  const messages = state.messages;
  const facts = state.knownFacts;
  state = send(state, 'EXPLORE', { preserveReading: true });
  assert.deepEqual(state.investigation.visited, []);
  assert.deepEqual(state.observations, []);
  state = restoreGame(saveGame(state).record).state;
  state = send(state, 'INSPECT', { hotspotId: 'case', resume: true });
  assert.equal(state.position, position);
  assert.deepEqual(state.messages, messages);
  assert.deepEqual(state.knownFacts, facts);
  assert.equal(publicView(state).currentMessage.id, messages.at(-1).id);
  assert.deepEqual(publicView(state).readingProgress, { read: position, total: state.segment.length });
  state = send(state, 'NEXT');
  assert.equal(state.messages.length, messages.length + 1);
  assert.equal(publicView(state).currentMessage?.text ?? state.messages.at(-1).text,
    state.segment[position].text);
});

test('each interrupted object keeps its own line while the history remains chronological', () => {
  let state = send(send(scene(), 'INSPECT', { hotspotId: 'case', resume: true }), 'NEXT');
  const caseMessage = state.messages.at(-1);
  state = send(state, 'EXPLORE', { preserveReading: true });
  state = send(send(state, 'INSPECT', { hotspotId: 'trail', resume: true }), 'NEXT');
  const trailMessage = state.messages.at(-1);
  state = send(state, 'EXPLORE', { preserveReading: true });
  const history = state.messages;
  state = send(state, 'INSPECT', { hotspotId: 'case', resume: true });
  assert.deepEqual(publicView(state).currentMessage, caseMessage);
  assert.deepEqual(state.messages, history);
  state = send(state, 'EXPLORE', { preserveReading: true });
  state = send(state, 'INSPECT', { hotspotId: 'trail', resume: true });
  assert.deepEqual(publicView(state).currentMessage, trailMessage);
  assert.deepEqual(state.messages, history);
  assert.deepEqual(restoreGame(saveGame(state).record).state, state);
});

test('completion records once and later inspections replay the authored object normally', () => {
  let state = send(scene(), 'INSPECT', { hotspotId: 'case', resume: true });
  state = send(state, 'EXPLORE', { preserveReading: true });
  state = read(send(state, 'INSPECT', { hotspotId: 'case', resume: true }));
  assert.deepEqual(state.investigation.visited, ['case']);
  assert.equal(state.observations.length, 1);
  state = send(state, 'EXPLORE', { preserveReading: true });
  state = send(state, 'INSPECT', { hotspotId: 'case', resume: true });
  assert.equal(state.position, 1);
  state = read(state);
  assert.equal(state.observations.length, 1);
});

test('unflagged inspection still starts at the beginning after an opted-in pause', () => {
  let state = send(send(scene(), 'INSPECT', { hotspotId: 'case' }), 'NEXT');
  state = send(state, 'EXPLORE', { preserveReading: true });
  state = send(state, 'INSPECT', { hotspotId: 'case' });
  assert.equal(state.position, 1);
});
