import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dispatch, publicView, saveGame, restoreGame } from '../src/playbook.mjs';
import { sha256 } from '../src/hash.mjs';

function event(state, type, fields = {}) {
  return dispatch(state, { type, teamId: state.teamId, sceneId: state.sceneId,
    revision: state.revision, ...fields });
}
function send(state, type, fields = {}) {
  const result = event(state, type, fields);
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.state;
}
function read(state) {
  if (state.phase === 'travelling')
    state = send(state, 'ARRIVE', { roomId: publicView(state).travel.toRoomId });
  while (publicView(state).canNext) state = send(state, 'NEXT');
  return state;
}
function firstScene() { return read(send(createGame(1).state, 'SKIP_INTRO')); }
function observe(state, ids = state.investigationDefinition.required) {
  for (const hotspotId of ids) state = read(send(state, 'INSPECT', { hotspotId }));
  return state;
}
const answers = { S01: 'trace', T21: 'after', D21: 'change', S22: 'tomorrow' };
function reach(sceneId) {
  let state = firstScene();
  for (const current of ['S01', 'I01', 'P11', 'S12', 'T21', 'D21']) {
    if (state.sceneId === sceneId) return state;
    assert.equal(state.sceneId, current);
    state = observe(state);
    if (answers[current]) state = send(state, 'DEDUCE', { answerId: answers[current] });
    if (current === 'P11')
      state = send(state, 'SOLVE', { answer: ['bell', 'leaf', 'wave', 'star'] });
    else state = send(send(state, 'OPEN_CHOICES'), 'CHOOSE', { choiceId: 'A' });
    state = read(send(read(state), 'CONTINUE'));
  }
  assert.equal(state.sceneId, sceneId);
  return state;
}

test('the first investigation plans a real route after observation without choosing a glass quiz answer', () => {
  let state = firstScene();
  assert.equal(publicView(state).exploration.deduction, null);
  assert.equal(publicView(state).exploration.canPlanInvestigation, false);
  assert.equal(event(state, 'OPEN_CHOICES', { fromObservations: true }).ok, false);
  state = observe(state, ['case', 'trail']);
  assert.equal(publicView(state).exploration.canPlanInvestigation, false);
  state = send(state, 'INSPECT', { hotspotId: 'schedule' });
  assert.equal(event(state, 'OPEN_CHOICES', { fromObservations: true }).ok, false);
  state = read(state);
  const view = publicView(state);
  assert.equal(view.exploration.canPlanInvestigation, true);
  assert.equal(view.exploration.primaryAction.kind, 'choices');
  assert.equal(view.exploration.primaryAction.label, '조사 방향 정하기');
  assert.equal(view.exploration.canChoose, false, 'legacy deduction readiness is unchanged');
  assert.equal(view.exploration.blockedReason, null);
  const before = state;
  state = send(state, 'OPEN_CHOICES', { fromObservations: true });
  assert.equal(state.phase, 'choosing');
  assert.deepEqual(publicView(state).choices.map(item => item.id), ['A', 'B', 'C', 'D']);
  assert.deepEqual(state.flags, before.flags);
  assert.deepEqual(state.knownFacts, before.knownFacts);
  assert.deepEqual(state.history, before.history);
  assert.equal(state.events.some(item => item.type === 'DEDUCE'), false);
  assert.deepEqual(restoreGame(saveGame(state).record).state, state);
  state = send(state, 'CHOOSE', { choiceId: 'A' });
  assert.equal(state.history.length, 1);
  assert.equal(state.nextSceneId, 'I01');
});

test('all four first-route decisions keep their existing consequences through the observation path', () => {
  const ready = observe(firstScene());
  const oldChoosing = send(send(ready, 'DEDUCE', { answerId: 'trace' }), 'OPEN_CHOICES');
  const newChoosing = send(ready, 'OPEN_CHOICES', { fromObservations: true });
  for (const choiceId of ['A', 'B', 'C', 'D']) {
    const previous = send(oldChoosing, 'CHOOSE', { choiceId });
    const current = send(newChoosing, 'CHOOSE', { choiceId });
    assert.deepEqual(current.flags, previous.flags);
    assert.deepEqual(current.history, previous.history);
    assert.equal(current.nextSceneId, previous.nextSceneId);
    assert.deepEqual(current.segment, previous.segment);
    assert.deepEqual(restoreGame(saveGame(current).record).state, current);
  }
});

test('the observation shortcut cannot bypass another scene or accept malformed opt-ins', () => {
  const first = observe(firstScene());
  assert.equal(event(first, 'OPEN_CHOICES').error.code, 'INVESTIGATION_INCOMPLETE');
  assert.equal(event(first, 'OPEN_CHOICES', { fromObservations: 'true' }).ok, false);
  const later = observe(reach('T21'));
  assert.equal(event(later, 'OPEN_CHOICES', { fromObservations: true }).ok, false);
  assert.equal(later.investigation.deductionSolved, false);
  const old = read(createGame(1, { mode: 'map', storyVersion: 'museum-map-3' }).state);
  assert.equal(event(observe(old), 'OPEN_CHOICES', { fromObservations: true }).ok, false);
});

test('old map events preserve their original state and checksum', () => {
  let state = observe(firstScene());
  state = send(send(state, 'DEDUCE', { answerId: 'trace' }), 'OPEN_CHOICES');
  state = send(state, 'CHOOSE', { choiceId: 'A' });
  assert.equal(sha256(JSON.stringify(state)),
    'c8f4e37f5ad5c9535c70d1c03e88f2f6e28b7cba7a1a8ea7b2b2899a0841872d');
  assert.equal(saveGame(state).record.checksum,
    '8a98c434244de8dff9cb45849bc9df9e06e061f4751f17b7baeea8a987e0c193');
  assert.deepEqual(restoreGame(saveGame(state).record).state, state);
});

test('later deductions explain their purpose and cite only evidence already displayed', () => {
  for (const [sceneId, actionLabel] of [
    ['T21', '이송 순서 추리하기'], ['D21', '기록의 차이 확인'], ['S22', '나래의 부탁 확인'],
  ]) {
    let state = reach(sceneId);
    assert.equal(publicView(state).exploration.deduction, null);
    state = observe(state);
    const deduction = publicView(state).exploration.deduction;
    assert.equal(deduction.actionLabel, actionLabel);
    assert.ok(deduction.title && deduction.context && deduction.purpose);
    assert.ok(deduction.evidence.length >= 2);
    for (const evidence of deduction.evidence) {
      const source = state.messages.find(message => message.id === evidence.sourceMessageId);
      assert.ok(source, `${sceneId}: source was already displayed`);
      assert.ok(source.text.includes(evidence.text), `${sceneId}: evidence quotes the source`);
      assert.ok(state.investigation.visited.includes(evidence.sourceHotspotId));
      assert.ok(deduction.requires.includes(evidence.sourceHotspotId));
    }
    assert.equal(publicView(state).exploration.primaryAction.label, actionLabel);
    assert.ok(!Object.hasOwn(deduction, 'answer'));
    assert.deepEqual(restoreGame(saveGame(state).record).state, state);
  }
});
