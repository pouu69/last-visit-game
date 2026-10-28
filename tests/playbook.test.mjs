import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createGame, dispatch, publicView, saveGame, restoreGame } from '../src/playbook.mjs';
import { INITIAL_FLAGS, applyRoute, hasCorrectionEvidence } from '../src/route-rules.mjs';
import { sha256 } from '../src/hash.mjs';

const TEST_TIMEOUT = 20_000;
const options = { timeout: TEST_TIMEOUT };
const examples = JSON.parse(
  readFileSync(new URL('../artifacts/narrative-check.json', import.meta.url), 'utf8')
);

function send(state, type, fields = {}) {
  const result = dispatch(state, {
    type,
    teamId: state.teamId,
    sceneId: state.sceneId,
    revision: state.revision,
    ...fields,
  });
  assert.equal(
    result.ok,
    true,
    `${state.sceneId}/${state.phase} ${type}: ${JSON.stringify(result.error)}`
  );
  return result;
}

function readSegment(state) {
  while (publicView(state).canNext) state = send(state, 'NEXT').state;
  return state;
}

function followRoute(route, teamId = 1) {
  let state = createGame(teamId, { mode: 'legacy' }).state;
  for (const match of route.matchAll(/([A-Z]\d{2})\.([ABCD])/g)) {
    const [, sceneId, choiceId] = match;
    assert.equal(state.sceneId, sceneId, `route ${route}`);
    state = readSegment(state);
    if (state.phase !== 'choosing') state = send(state, 'OPEN_CHOICES').state;
    const before = state;
    state = send(state, 'CHOOSE', { choiceId }).state;
    assert.equal(before.history.length + 1, state.history.length);
    assert.equal(before.flags.boat, before.history.at(-1)?.after.boat ?? 'locked');
    state = readSegment(state);
    state = send(state, 'CONTINUE').state;
  }
  return state;
}

test(
  'all six reviewed endings remain reachable after a failed crane mission',
  options,
  async (t) => {
    for (const [ending, route] of Object.entries(examples.ending_examples)) {
      await t.test(ending, () => {
        const state = readSegment(followRoute(route));
        assert.equal(state.sceneId, ending, route);
        assert.equal(state.phase, 'terminal');
        assert.equal(state.history.length, 11);
        assert.equal(state.flags.crane, 'stalled');
        assert.equal(publicView(state).choices.length, 0);
        assert.equal(sendRejection(state, 'NEXT'), 'GAME_FINISHED');
      });
    }
  }
);

function sendRejection(state, type, fields = {}) {
  const result = dispatch(state, {
    type,
    teamId: state.teamId,
    sceneId: state.sceneId,
    revision: state.revision,
    ...fields,
  });
  assert.equal(result.ok, false);
  return result.error.code;
}

test(
  'three tabletop routes preserve their independently reviewed resources and replay exactly',
  options,
  () => {
    let teamId = 1;
    for (const [name, example] of Object.entries(examples.tabletop_examples)) {
      const state = readSegment(followRoute(example.route, teamId++));
      const held = Object.keys(INITIAL_FLAGS)
        .filter((key) => state.flags[key] === true)
        .sort();
      assert.deepEqual(held, example.flags, name);
      for (const key of ['boat', 'record', 'moro'])
        assert.equal(state.flags[key], example[key], name);
      const saved = saveGame(state);
      assert.equal(saved.ok, true);
      const restored = restoreGame(JSON.parse(JSON.stringify(saved.record)));
      assert.equal(restored.ok, true, JSON.stringify(restored.error));
      assert.deepEqual(restored.state, state, name);
      assert.deepEqual(restored.effects, []);
      assert.equal(Object.isFrozen(state.flags), true);
    }
  }
);

test(
  'conditional rescue, repair and testimony consume only the required owned resource',
  options,
  () => {
    const cases = [
      [
        'R31',
        'D',
        { maintenance: true, battery: true },
        { boat: 'intact', record: 'intact', battery: false, moro: 'active' },
        'S31',
      ],
      [
        'R31',
        'D',
        { maintenance: false, battery: true },
        { boat: 'sealed', record: 'sealed', battery: true },
        'S31',
      ],
      [
        'R32',
        'C',
        { battery: false },
        { boat: 'intact', record: 'unreadable', moro: 'asleep' },
        'S31',
      ],
      [
        'R32',
        'C',
        { battery: true },
        { boat: 'intact', record: 'intact', moro: 'asleep', battery: false },
        'S31',
      ],
      ['R32', 'D', { maintenance: true }, { boat: 'intact', record: 'unreadable' }, 'S31'],
      ['F31', 'B', { boat: 'damaged', repair: true }, { boat: 'intact', repair: false }, 'E1'],
      ['F31', 'B', { boat: 'sealed', repair: true }, { boat: 'sealed', repair: true }, 'E2'],
      [
        'F32',
        'B',
        { record: 'intact', moro: 'asleep', battery: true },
        { log: true, battery: false, moro: 'active' },
        'E3',
      ],
      ['F32', 'B', { record: 'intact', moro: 'asleep' }, { log: false, moro: 'asleep' }, 'E4'],
      ['F33', 'B', { moro: 'active', battery: true }, { moro: 'active', battery: true }, 'E5'],
    ];
    for (const [scene, choice, input, expected, destination] of cases) {
      const before = Object.freeze({ ...INITIAL_FLAGS, ...input });
      const result = applyRoute(scene, choice, before);
      assert.equal(result.nextSceneId, destination, `${scene}.${choice}`);
      for (const [key, value] of Object.entries(expected))
        assert.equal(result.flags[key], value, `${scene}.${choice} ${key}`);
    }
    assert.equal(hasCorrectionEvidence({ ...INITIAL_FLAGS, record: 'intact' }), false);
    assert.equal(
      hasCorrectionEvidence({ ...INITIAL_FLAGS, charter: true, request: true }),
      true
    );
  }
);

test(
  'only read messages reach the browser, and stale or cross-team events cannot commit choices',
  options,
  () => {
    const initial = createGame(1, { mode: 'legacy' }).state;
    assert.equal(publicView(initial).messages.length, 1);
    assert.equal(Object.hasOwn(publicView(initial), 'segment'), false);
    const opened = send(initial, 'OPEN_CHOICES').state;
    assert.deepEqual(opened.knownFacts, initial.knownFacts);
    assert.equal(publicView(opened).choices.length, 4);
    const resumed = send(opened, 'BACK').state;
    assert.equal(resumed.position, initial.position);
    assert.equal(sendRejection(resumed, 'NEXT', { teamId: 2 }), 'TEAM_MISMATCH');
    assert.equal(sendRejection(resumed, 'NEXT', { revision: 0 }), 'STALE_EVENT');
    assert.deepEqual(initial.flags, INITIAL_FLAGS);
  }
);

test(
  'T22 challenge reuses the receipt rule without granting a signed statement or an item',
  options,
  () => {
    let state = readSegment(followRoute('S01.C I03.C P11.B S12.C'));
    assert.equal(state.phase, 'input');
    assert.equal(state.activeClaimId, 'no_request');
    const before = state.flags;
    state = send(state, 'TOPIC', { topicId: 'receipt' }).state;
    state = readSegment(state);
    assert.deepEqual(state.flags, before);
    assert.equal(state.flags.statement, false);
    assert.ok(state.knownFacts.includes('request_received'));
    assert.ok(state.knownFacts.includes('return_delayed'));
    assert.equal(state.activeClaimId, null);
    const restored = restoreGame(saveGame(state).record);
    assert.equal(restored.ok, true);
    assert.deepEqual(restored.state, state);
  }
);

test(
  'I04 admission and legacy AI replies survive while public AI events are retired and pending saves resume',
  options,
  () => {
    let state = readSegment(followRoute('S01.D I04.C P12.C S12.D'));
    assert.equal(state.flags.request, false);
    assert.ok(state.knownFacts.includes('request_received'));
    assert.equal(
      state.messages.some((message) =>
        message.text.startsWith('돌려달라는 연락은 받은 적 없어요.')
      ),
      false
    );
    for (const type of ['ASK', 'AI_RESOLVE', 'AI_FAIL', 'CANCEL'])
      assert.equal(sendRejection(state, type, { requestId: 'retired' }), 'AI_DISABLED');
    assert.equal(Object.hasOwn(publicView(state), 'pendingRequest'), false);
    assert.equal(Object.hasOwn(publicView(state), 'aiTurnsRemaining'), false);
    state = readSegment(followRoute('S01.C I03.C P11.B S12.C'));
    const { checksum: originalChecksum, ...original } = saveGame(state).record;
    assert.equal(
      originalChecksum,
      createHash('sha256').update(JSON.stringify(original)).digest('hex')
    );
    const request = {
      type: 'ASK',
      teamId: state.teamId,
      sceneId: state.sceneId,
      revision: state.revision,
      requestId: 'receipt-old',
      text: '요청서의 수신 확인이 관장님 서명인데 왜 못 받았다고 하세요?',
      evidenceId: 'request',
    };
    const reply = {
      type: 'AI_RESOLVE',
      teamId: state.teamId,
      sceneId: state.sceneId,
      revision: state.revision + 1,
      requestId: request.requestId,
      interpretation: { kind: 'challenge', claimId: 'no_request', verdict: 'supported' },
      replies: [{ speaker: '윤서', text: '당시 요청을 읽었습니다.' }],
    };
    const legacyRecord = (events) => {
      const payload = { ...original, events: [...original.events, ...events] };
      return {
        ...payload,
        checksum: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
      };
    };
    const resolved = restoreGame(legacyRecord([request, reply]));
    assert.equal(resolved.ok, true, JSON.stringify(resolved.error));
    const acknowledged = readSegment(resolved.state);
    assert.ok(acknowledged.messages.some(({ text }) => text === '당시 요청을 읽었습니다.'));
    assert.ok(acknowledged.knownFacts.includes('return_delayed'));
    assert.deepEqual(acknowledged.flags, state.flags);
    assert.deepEqual(acknowledged.history, state.history);
    assert.deepEqual(resolved.effects, []);
    assert.deepEqual(restoreGame(saveGame(acknowledged).record).state, acknowledged);

    const pending = restoreGame(legacyRecord([request]));
    assert.equal(pending.ok, true, JSON.stringify(pending.error));
    assert.equal(pending.state.phase, 'input');
    assert.equal(pending.state.pendingRequest, null);
    assert.equal(pending.state.events.at(-1).type, 'CANCEL');
    assert.deepEqual(pending.effects, []);
    assert.deepEqual(restoreGame(saveGame(pending.state).record).state, pending.state);
    assert.equal(send(pending.state, 'TOPIC', { topicId: 'receipt' }).state.phase, 'reading');
  }
);

test('save integrity, versions and event replay reject tampering', options, () => {
  for (const text of [
    '',
    'abc',
    '한글 🚤',
    '\ud800',
    ...[55, 56, 63, 64, 65, 1_000_000].map((length) => 'a'.repeat(length)),
  ])
    assert.equal(
      sha256(text),
      createHash('sha256').update(text).digest('hex'),
      `UTF-8 SHA-256, ${text.length} code units`
    );
  const state = send(createGame(3, { mode: 'legacy' }).state, 'NEXT').state;
  const record = saveGame(state).record;
  assert.equal(restoreGame({ ...record, version: 2 }).error.code, 'VERSION_MISMATCH');
  assert.equal(restoreGame({ ...record, teamId: 1 }).error.code, 'CHECKSUM_MISMATCH');
  assert.equal(restoreGame({ ...record, flags: INITIAL_FLAGS }).error.code, 'VERSION_MISMATCH');
});
