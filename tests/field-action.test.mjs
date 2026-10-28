import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dispatch, publicView, saveGame, restoreGame } from '../src/playbook.mjs';
import { FIELD_ACTION_ID, fieldActionFor, fieldHotspots } from '../public/field-action.mjs';

function send(state, type, fields = {}) {
  const result = dispatch(state, { type, teamId: state.teamId, sceneId: state.sceneId,
    revision: state.revision, ...fields });
  assert.ok(result.ok, JSON.stringify(result.error));
  return result.state;
}
function read(state) {
  if (state.phase === 'travelling')
    state = send(state, 'ARRIVE', { roomId: publicView(state).travel.toRoomId });
  while (publicView(state).canNext) state = send(state, 'NEXT');
  return state;
}
function observe(state) {
  for (const hotspotId of state.investigationDefinition.required)
    state = read(send(state, 'INSPECT', { hotspotId }));
  return send(state, 'EXPLORE');
}
function firstScene() { return read(send(createGame(1).state, 'SKIP_INTRO')); }
function choose(state, choiceId = 'A') {
  state = send(state, 'OPEN_CHOICES', publicView(state).exploration.canPlanInvestigation
    ? { fromObservations: true } : {});
  return read(send(read(send(state, 'CHOOSE', { choiceId })), 'CONTINUE'));
}

test('a ready world interaction appears only after the required observation and reading', () => {
  let state = firstScene();
  assert.equal(fieldActionFor(publicView(state)), null);
  for (const hotspotId of state.investigationDefinition.required) {
    state = send(state, 'INSPECT', { hotspotId });
    assert.equal(fieldActionFor(publicView(state)), null, 'no marker while reading');
    state = read(state);
  }
  state = send(state, 'EXPLORE');
  const before = structuredClone(state);
  const view = publicView(state);
  const action = fieldActionFor(view);
  assert.equal(action.id, FIELD_ACTION_ID);
  assert.equal(action.anchor, 'moro');
  assert.match(action.objective, /모로에게 다가가세요/);
  assert.equal(view.exploration.primaryAction.kind, 'choices');
  assert.deepEqual(state, before, 'guidance never commits a decision');
  assert.deepEqual(restoreGame(saveGame(state).record).state, state);
  assert.equal(fieldActionFor({ ...view, phase: 'choosing' }), null);
  assert.equal(fieldActionFor({ ...view, phase: 'travelling' }), null);
  state = send(state, 'OPEN_CHOICES', { fromObservations: true });
  assert.equal(fieldActionFor(publicView(state)), null);
  state = send(state, 'BACK');
  assert.equal(fieldActionFor(publicView(state)).anchor, 'moro', 'back restores the world action');
});

test('equipment, puzzle and deduction interactions use their scene objects', () => {
  let state = choose(observe(firstScene()));
  assert.equal(state.sceneId, 'I01');
  state = observe(state);
  let view = publicView(state);
  const action = fieldActionFor(view);
  assert.equal(action.label, '챙길 장비 정하기');
  const hotspots = fieldHotspots(view.exploration, action);
  assert.equal(hotspots[0].id, FIELD_ACTION_ID);
  assert.ok(hotspots.some(item => item.id === 'supplies'), 'optional equipment observation stays available');
  assert.ok(hotspots.some(item => item.id === 'receipt'), 'conversation and reinspection keep their original target');
  assert.ok(view.exploration.observations.some(item => item.id === 'receipt'));
  state = observe(choose(state));
  assert.equal(state.sceneId, 'P11');
  assert.equal(fieldActionFor(publicView(state)).anchor, 'terminal');
  assert.equal(publicView(state).exploration.primaryAction.kind, 'puzzle');
  state = send(state, 'SOLVE', { answer: ['bell', 'leaf', 'wave', 'star'] });
  assert.equal(fieldActionFor(publicView(state)), null, 'result has no ready action');
  state = observe(read(send(read(state), 'CONTINUE')));
  assert.equal(state.sceneId, 'S12');
  state = observe(choose(state));
  assert.equal(state.sceneId, 'T21');
  assert.equal(publicView(state).exploration.primaryAction.kind, 'deduce');
  assert.equal(fieldActionFor(publicView(state)).label, '이송 순서 맞추기');
  state = send(state, 'DEDUCE', { answerId: 'after' });
  assert.equal(fieldActionFor(publicView(state)).label, '실행할 일 정하기');
});

test('world action projection preserves unvisited targets and the server observation list', () => {
  const exploration = { hotspots: [
    { id: 'optional', anchor: 'desk', visited: false },
    { id: 'known', anchor: 'desk', visited: true },
    { id: 'other', anchor: 'moro', visited: true },
  ] };
  const before = structuredClone(exploration);
  assert.deepEqual(fieldHotspots(exploration, { id: FIELD_ACTION_ID, anchor: 'desk' }).map(x => x.id),
    [FIELD_ACTION_ID, 'optional', 'known', 'other']);
  assert.deepEqual(exploration, before);
  assert.equal(fieldHotspots(exploration, null), exploration.hotspots);
  assert.equal(fieldActionFor(null), null);
});

test('older first-room saves keep the optional Moro observation reachable', () => {
  const state = observe(read(createGame(1, { mode: 'map', storyVersion: 'museum-map-3' }).state));
  const view = publicView(state);
  const action = fieldActionFor(view);
  assert.equal(action.anchor, 'case');
  const hotspots = fieldHotspots(view.exploration, action);
  assert.equal(hotspots.find(item => item.anchor === 'moro').id, 'trail');
  assert.ok(hotspots.find(item => item.id === 'trail').visited === false);
});
