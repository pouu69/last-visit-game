import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createT22, transition, replayT22, LIMITS } from '../src/game-state.mjs';

const TIMEOUT_MS = 2000;
const scenario = (name, body) => test(name, { timeout: TIMEOUT_MS }, body);

function start(overrides = {}) {
  const result = createT22({ teamId: 1, entryRoute: 'I03', evidence: ['request'], resources: [], ...overrides });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.state;
}

function event(state, type, fields = {}) {
  return { type, teamId: state.teamId, sceneId: state.sceneId, sceneRevision: state.sceneRevision, ...fields };
}

function apply(state, type, fields = {}) {
  const result = transition(state, event(state, type, fields));
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.state;
}

function read(state) {
  for (let count = 0; count <= LIMITS.messagesPerReply; count += 1) {
    if (state.phase !== 'reading' && !(state.phase === 'result' && state.readingPosition < state.segment.length)) return state;
    state = apply(state, 'NEXT_MESSAGE');
  }
  assert.fail('Message segment did not finish within its declared limit');
}

function deny(state = start()) {
  state = read(state);
  state = apply(state, 'SELECT_TOPIC', { topicId: 'return_request' });
  return read(state);
}

function submit(state, fields = {}) {
  return apply(state, 'SUBMIT_TEXT', { requestId: 'q1', text: '요청서에 수신 확인이 있는데 왜 못 받았다고 하세요?', evidenceId: 'request', ...fields });
}

function admit(state) {
  return apply(state, 'RESOLVE_TURN', { requestId: 'q1', interpretation: { kind: 'challenge', claimId: 'no_request', verdict: 'supported' } });
}

scenario('US01: reading reveals only displayed claims and never awards inventory', () => {
  let state = start();
  assert.equal(state.activeClaimId, null);
  const initial = structuredClone(state);
  state = read(state);
  state = apply(state, 'SELECT_TOPIC', { topicId: 'return_request' });
  assert.equal(state.activeClaimId, null);
  state = apply(state, 'NEXT_MESSAGE');
  assert.equal(state.activeClaimId, 'no_request');
  assert.deepEqual(state.evidence, initial.evidence);
  assert.deepEqual(state.resources, initial.resources);
  assert.equal(initial.messages.length, 1);
});

scenario('US02: supported contradiction records oral admission but does not grant a signature', () => {
  const before = deny();
  const snapshot = structuredClone(before);
  let state = submit(before);
  assert.equal(state.phase, 'evaluating');
  state = read(admit(state));
  assert.deepEqual(state.knownFacts, ['request_received', 'return_delayed']);
  assert.equal(state.activeClaimId, null);
  assert.equal(state.evidence.includes('statement'), false);
  assert.deepEqual(before, snapshot);
  assert.equal(Object.isFrozen(state.messages[0]), true);
});

for (const evidence of [[], ['request']]) {
  scenario(`US03: I04 preserves prior admission with evidence ${JSON.stringify(evidence)}`, () => {
    let state = read(start({ entryRoute: 'I04', evidence }));
    state = read(apply(state, 'SELECT_TOPIC', { topicId: 'return_request' }));
    assert.equal(state.activeClaimId, null);
    assert.equal(state.knownFacts.includes('request_received'), true);
    assert.equal(state.messages.some(message => message.text.includes('받은 적 없어요')), false);
  });
}

scenario('US04: a worn key does not prove recent use even when the topic is requested', () => {
  const state = read(apply(read(start({ evidence: [] })), 'SELECT_TOPIC', { topicId: 'key' }));
  assert.deepEqual(state.knownFacts, []);
  assert.deepEqual(state.evidence, []);
  assert.match(state.messages.at(-1).text, /어제/);
});

scenario('US05: authored conversation contains substantial dialogue without consuming AI turns', () => {
  let state = read(start());
  for (const topicId of ['interruption', 'finish_explanation', 'movement_order', 'return_request', 'receipt', 'reply_to_nara', 'deadline', 'first_exhibit', 'empty_case', 'explanation', 'records']) {
    state = read(apply(state, 'SELECT_TOPIC', { topicId }));
  }
  assert.ok(state.messages.length >= 25, `${state.messages.length} messages should contain the extended scene`);
  assert.equal(state.requests.length, 0);
  assert.equal(state.evidence.includes('statement'), false);
});

for (const [choiceId, asset, nextSceneId] of [['A', 'statement', 'D21'], ['B', 'request', 'D21'], ['C', 'battery', 'D22'], ['D', 'map', 'D22']]) {
  scenario(`US06/07: ${choiceId} commits ${asset} once and hands off to ${nextSceneId}`, () => {
    let state = apply(start(), 'OPEN_CHOICES');
    state = apply(state, 'CONFIRM_CHOICE', { choiceId });
    assert.equal(state.phase, 'result');
    assert.equal([...state.evidence, ...state.resources].filter(item => item === asset).length, 1);
    const repeat = transition(state, event(state, 'CONFIRM_CHOICE', { choiceId }));
    assert.equal(repeat.error.code, 'EVENT_NOT_ALLOWED');
    assert.equal(transition(state, event(state, 'CONTINUE')).error.code, 'RESULT_UNREAD');
    if (choiceId === 'A') assert.equal(state.knownFacts.includes('return_clause_removed'), true);
    if (choiceId === 'C') assert.equal(state.evidence.includes('statement'), false);
    state = read(state);
    const result = transition(state, event(state, 'CONTINUE'));
    assert.equal(result.ok, true);
    assert.equal(result.state.phase, 'handoff');
    assert.equal(result.state.sceneId, nextSceneId);
    assert.equal(result.state.sceneRevision, 2);
    assert.deepEqual(result.effects, [{ type: 'ENTER_SCENE', sceneId: nextSceneId, teamId: 1, sceneRevision: 2 }]);
    assert.equal(transition(result.state, event(result.state, 'OPEN_CHOICES')).error.code, 'SCENE_HANDOFF');
  });
}

scenario('US08: duplicate submission creates no second effect and conflicting reuse is rejected', () => {
  const state = deny();
  const command = event(state, 'SUBMIT_TEXT', { requestId: 'q1', text: '확인하셨죠?', evidenceId: 'request' });
  const first = transition(state, command);
  assert.equal(first.effects.length, 1);
  const second = transition(first.state, command);
  assert.equal(second.ok, true);
  assert.equal(second.state, first.state);
  assert.deepEqual(second.effects, []);
  const conflict = transition(first.state, { ...command, text: '다른 질문' });
  assert.equal(conflict.error.code, 'REQUEST_ID_CONFLICT');
});

for (const type of ['CANCEL_TURN', 'OPEN_CHOICES']) {
  scenario(`US09: ${type} invalidates a pending response without inventing an admission`, () => {
    const pending = submit(deny());
    const cancelled = transition(pending, event(pending, type, type === 'CANCEL_TURN' ? { requestId: 'q1' } : {}));
    assert.equal(cancelled.ok, true);
    assert.deepEqual(cancelled.effects, [{ type: 'CANCEL_REQUEST', requestId: 'q1', teamId: 1 }]);
    const late = transition(cancelled.state, event(pending, 'RESOLVE_TURN', { requestId: 'q1', interpretation: { kind: 'challenge', claimId: 'no_request', verdict: 'supported' } }));
    assert.equal(late.error.code, 'STALE_RESPONSE');
    assert.deepEqual(cancelled.state.knownFacts, []);
  });
}

for (const failure of ['timeout', 'refusal', 'invalid_output', 'quota', 'network']) {
  scenario(`US10: ${failure} leaves authored dialogue and choices available`, () => {
    let state = submit(deny());
    state = read(apply(state, 'FAIL_TURN', { requestId: 'q1', reason: failure }));
    assert.equal(state.phase, 'input');
    assert.deepEqual(state.knownFacts, []);
    state = apply(state, 'OPEN_CHOICES');
    state = apply(state, 'CONFIRM_CHOICE', { choiceId: 'A' });
    assert.equal(state.evidence.includes('statement'), true);
  });
}

scenario('US10: request cap preserves authored evidence questioning without extra API effects', () => {
  let state = deny();
  for (let index = 0; index < LIMITS.aiTurns; index += 1) {
    state = submit(state, { requestId: `q${index}` });
    state = read(apply(state, 'FAIL_TURN', { requestId: `q${index}`, reason: 'timeout' }));
  }
  const capped = transition(state, event(state, 'SUBMIT_TEXT', { requestId: 'extra', text: '다시 묻기', evidenceId: 'request' }));
  assert.equal(capped.error.code, 'TURN_LIMIT');
  state = read(apply(state, 'SELECT_TOPIC', { topicId: 'receipt' }));
  assert.equal(state.knownFacts.includes('request_received'), true);
  assert.equal(state.requests.length, LIMITS.aiTurns);
});

scenario('US11: another team cannot resolve a pending turn or modify its independent state', () => {
  const teamOne = submit(deny());
  const teamTwo = start({ teamId: 2 });
  const result = transition(teamOne, event(teamOne, 'RESOLVE_TURN', { teamId: 2, requestId: 'q1', interpretation: { kind: 'unclear' } }));
  assert.equal(result.error.code, 'TEAM_MISMATCH');
  const resolved = read(admit(teamOne));
  assert.equal(resolved.knownFacts.includes('request_received'), true);
  assert.deepEqual(teamTwo.knownFacts, []);
});

scenario('US12: replay reproduces state and displayed messages without executing external effects', () => {
  let state = read(admit(submit(deny())));
  state = apply(state, 'OPEN_CHOICES');
  state = read(apply(state, 'CONFIRM_CHOICE', { choiceId: 'C' }));
  state = apply(state, 'CONTINUE');
  const record = { storyVersion: state.storyVersion, rulesVersion: state.rulesVersion, entry: state.entry, events: state.journal.map(item => item.event) };
  const first = replayT22(record);
  const second = replayT22(record);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.deepEqual(first.state, state);
  assert.deepEqual(second, first);
  assert.deepEqual(first.effects, []);
  assert.equal(replayT22({ ...record, rulesVersion: 'unknown' }).error.code, 'VERSION_MISMATCH');
  assert.equal(replayT22({ ...record, events: [...record.events, {}] }).error.code, 'REPLAY_EVENT_REJECTED');
});

for (const [label, text, accepted] of [['empty', '', false], ['one', '가', true], ['maximum', '가'.repeat(600), true], ['over', '가'.repeat(601), false], ['emoji', '🛶'.repeat(600), true], ['control', '\u0000', false]]) {
  scenario(`US13: ${label} input has a defined bounded outcome`, () => {
    const state = read(start());
    const result = transition(state, event(state, 'SUBMIT_TEXT', { requestId: 'bounds', text, evidenceId: null }));
    assert.equal(result.ok, accepted);
    if (!accepted) assert.equal(result.error.code, 'INVALID_INPUT');
    assert.equal(state.requests.length, 0);
  });
}

scenario('US13: missing evidence and unrecognized input are rejected before effects', () => {
  const state = read(start({ evidence: [] }));
  assert.equal(transition(state, event(state, 'SUBMIT_TEXT', { requestId: 'q1', text: '요청서가 있어요', evidenceId: 'request' })).error.code, 'EVIDENCE_NOT_OWNED');
  for (const input of [null, [], {}, { type: 'GRANT_ITEM' }]) {
    assert.equal(transition(state, input).ok, false);
  }
  assert.deepEqual(state.knownFacts, []);
});

scenario('unowned or unspoken evidence cannot become a supported challenge via model output', () => {
  for (const prepare of [() => read(start()), () => deny(start({ evidence: [] }))]) {
    let state = submit(prepare(), { evidenceId: null });
    state = read(admit(state));
    assert.deepEqual(state.knownFacts, []);
    assert.equal(state.evidence.includes('statement'), false);
  }
});

scenario('an action request proposes A but does not execute it', () => {
  let state = submit(read(start()), { evidenceId: null, text: '서명해 주세요' });
  state = read(apply(state, 'RESOLVE_TURN', { requestId: 'q1', interpretation: { kind: 'action', choiceId: 'A' } }));
  assert.equal(state.phase, 'input');
  assert.equal(state.evidence.includes('statement'), false);
  assert.match(state.messages.at(-1).text, /A/);
});

scenario('malformed model output falls back without applying injected facts or items', () => {
  const pending = submit(deny());
  const state = read(apply(pending, 'RESOLVE_TURN', { requestId: 'q1', interpretation: { kind: 'unclear', grant: 'statement' } }));
  assert.equal(state.phase, 'input');
  assert.equal(state.evidence.includes('statement'), false);
  assert.deepEqual(state.knownFacts, []);
});

scenario('malformed JSON event type cannot crash the input boundary', () => {
  const state = read(start());
  for (const type of [null, [], {}, { toString: null, valueOf: null }, '__proto__', 'x'.repeat(5000)]) {
    assert.doesNotThrow(() => {
      assert.equal(transition(state, event(state, type)).error.code, 'INVALID_EVENT');
    });
  }
});

scenario('showing a receipt before a denial asks a neutral question instead of inventing a prior lie', () => {
  const state = apply(read(start()), 'SELECT_TOPIC', { topicId: 'receipt' });
  assert.match(state.messages.at(-1).text, /누구|하신/);
  assert.doesNotMatch(state.messages.at(-1).text, /못 받았/);
});

scenario('returning from choices resumes unread dialogue without leaking its facts', () => {
  let state = apply(read(start()), 'SELECT_TOPIC', { topicId: 'receipt' });
  state = apply(state, 'OPEN_CHOICES');
  assert.deepEqual(state.knownFacts, []);
  state = apply(state, 'BACK_TO_DIALOGUE');
  assert.equal(state.phase, 'reading');
  assert.deepEqual(state.knownFacts, []);
  state = read(state);
  assert.deepEqual(state.knownFacts, ['request_received', 'return_delayed']);
});

for (const interpretation of [
  { kind: 'challenge', claimId: 'no_request', verdict: 'unsupported' },
  { kind: 'challenge', claimId: 'no_request', verdict: 'unclear' },
  { kind: 'topic', topicId: 'first_exhibit' },
  { kind: 'topic', topicId: 'key' },
  { kind: 'unclear' },
]) {
  scenario(`candidate ${JSON.stringify(interpretation)} cannot invent oral admission`, () => {
    const state = read(apply(submit(deny()), 'RESOLVE_TURN', { requestId: 'q1', interpretation }));
    assert.deepEqual(state.knownFacts, []);
  });
}

scenario('malformed response is replayed as a failure without keeping cyclic adapter data', () => {
  const bad = { kind: 'unclear' };
  bad.nested = bad;
  const state = apply(submit(deny()), 'RESOLVE_TURN', { requestId: 'q1', interpretation: bad });
  const record = { storyVersion: state.storyVersion, rulesVersion: state.rulesVersion, entry: state.entry, events: state.journal.map(item => item.event) };
  assert.doesNotThrow(() => JSON.stringify(record));
  assert.deepEqual(replayT22(record).state, state);
});

scenario('stale responses after handoff never modify the next scene', () => {
  const pending = submit(deny());
  let state = apply(pending, 'OPEN_CHOICES');
  state = read(apply(state, 'CONFIRM_CHOICE', { choiceId: 'C' }));
  state = apply(state, 'CONTINUE');
  const result = transition(state, event(pending, 'RESOLVE_TURN', { requestId: 'q1', interpretation: { kind: 'unclear' } }));
  assert.equal(result.error.code, 'STALE_RESPONSE');
  assert.equal(state.sceneId, 'D22');
  assert.deepEqual(state.knownFacts, []);
});

scenario('dialogue caps still leave enough room to choose, read the result, and hand off', () => {
  let state = read(start());
  for (let count = 0; count <= LIMITS.events; count += 1) {
    state = apply(state, 'OPEN_CHOICES');
    const back = transition(state, event(state, 'BACK_TO_DIALOGUE'));
    if (!back.ok) {
      assert.equal(back.error.code, 'DIALOGUE_LIMIT');
      break;
    }
    state = back.state;
  }
  state = read(apply(state, 'CONFIRM_CHOICE', { choiceId: 'A' }));
  state = apply(state, 'CONTINUE');
  assert.equal(state.phase, 'handoff');
  assert.ok(state.journal.length <= LIMITS.events);
});
