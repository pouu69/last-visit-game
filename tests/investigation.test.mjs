import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, dispatch, publicView, saveGame, restoreGame } from '../src/playbook.mjs';
import { INITIAL_FLAGS } from '../src/route-rules.mjs';

const options = { timeout: 20_000 };
const examples = JSON.parse(
  readFileSync(new URL('../artifacts/narrative-check.json', import.meta.url), 'utf8')
);
const observations = {
  S01: ['case'],
  I01: ['receipt'],
  I02: ['label'],
  I03: ['water'],
  I04: ['receipt'],
  P11: ['manifest'],
  P12: ['map'],
  S12: ['admission'],
  T21: ['order', 'fault'],
  T22: ['account'],
  D21: ['compare'],
  D22: ['valve', 'rail'],
  S22: ['story', 'request', 'rescue'],
  P21: ['sequence', 'interlock'],
  R31: ['crates', 'power'],
  R32: ['hook', 'power', 'bypass'],
  S31: ['report', 'promise', 'consent'],
  F31: ['condition'],
  F32: ['evidence', 'power'],
  F33: ['record'],
  F34: ['inventory'],
};
const deductions = { S01: 'trace', T21: 'after', D21: 'change', S22: 'tomorrow' };
const puzzleAnswers = {
  P11: {
    A: ['bell', 'leaf', 'wave', 'star'],
    B: ['wave', 'star', 'bell', 'leaf'],
    C: ['star', 'bell', 'leaf', 'wave'],
    D: ['bell', 'wave', 'leaf', 'star'],
  },
  P12: {
    A: ['entrance', 'archive', 'return'],
    B: ['entrance', 'pump', 'return'],
    C: ['entrance', 'garden', 'return'],
    D: ['entrance', 'office', 'archive', 'return'],
  },
  P21: {
    A: ['brace', 'shut', 'lift', 'power'],
    B: ['shut', 'brace', 'lift', 'power'],
    C: ['shut', 'power', 'brace', 'lift'],
    D: ['shut', 'lift', 'brace', 'power'],
  },
};

function event(state, type, fields = {}) {
  return dispatch(state, {
    type,
    teamId: state.teamId,
    sceneId: state.sceneId,
    revision: state.revision,
    ...fields,
  });
}

function send(state, type, fields = {}) {
  const result = event(state, type, fields);
  assert.equal(
    result.ok,
    true,
    `${state.sceneId}/${state.phase} ${type}: ${JSON.stringify(result.error)}`
  );
  return result.state;
}

function read(state) {
  if (state.phase === 'travelling')
    state = send(state, 'ARRIVE', { roomId: publicView(state).travel.toRoomId });
  while (publicView(state).canNext) state = send(state, 'NEXT');
  return state;
}

function investigate(state) {
  state = read(state);
  const required =
    state.sceneId === 'S01' && state.storyVersion === 'museum-map-4'
      ? ['case', 'trail', 'schedule']
      : observations[state.sceneId];
  for (const hotspotId of required) state = read(send(state, 'INSPECT', { hotspotId }));
  if (deductions[state.sceneId])
    state = send(state, 'DEDUCE', { answerId: deductions[state.sceneId] });
  return state;
}

function follow(route, teamId = 1, mode, storyVersion, transcript) {
  let state = createGame(teamId, { mode, storyVersion }).state;
  if (state.sceneId === 'O00') state = send(state, 'SKIP_INTRO');
  for (const [, sceneId, choiceId] of route.matchAll(/([A-Z]\d{2})\.([ABCD])/g)) {
    assert.equal(state.sceneId, sceneId, route);
    state = investigate(state);
    if (puzzleAnswers[sceneId])
      state = send(state, 'SOLVE', { answer: puzzleAnswers[sceneId][choiceId] });
    else state = send(send(state, 'OPEN_CHOICES'), 'CHOOSE', { choiceId });
    assert.equal(state.history.at(-1).choiceId, choiceId, `${sceneId}.${choiceId}`);
    state = read(state);
    transcript?.push(...state.messages);
    state = send(state, 'CONTINUE');
  }
  return state;
}

test(
  'the playable visit unlocks invitation, curator, travel and the discovery in order while skip and prior saves preserve the eleven decisions',
  options,
  () => {
    const initial = createGame(1).state;
    let state = initial;
    assert.equal(state.sceneId, 'O00');
    assert.equal(state.currentRoomId, 'foyer');
    assert.equal(state.phase, 'exploring');
    assert.equal(state.messages.length, 1);
    assert.equal(publicView(state).npc, null);
    assert.deepEqual(
      publicView(state).exploration.hotspots.map(({ id }) => id),
      ['invitation']
    );
    assert.equal(publicView(state).exploration.recommendedHotspotId, 'invitation');
    assert.equal(publicView(state).exploration.primaryAction.kind, 'inspect');
    assert.match(publicView(state).exploration.reason, /마지막 야간 관람객/);
    assert.equal(event(state, 'CONTINUE').error.code, 'VISIT_INCOMPLETE');
    assert.equal(event(state, 'OPEN_CHOICES').error.code, 'VISIT_NOT_A_DECISION');
    assert.equal(
      event(state, 'ASK', { requestId: 'intro', text: '안녕하세요', evidenceId: null }).error
        .code,
      'AI_DISABLED'
    );
    assert.equal(
      event(state, 'INSPECT', { hotspotId: 'curator' }).error.code,
      'HOTSPOT_LOCKED'
    );
    state = send(state, 'INSPECT', { hotspotId: 'invitation' });
    state = send(state, 'EXPLORE');
    assert.equal(
      event(state, 'INSPECT', { hotspotId: 'curator' }).error.code,
      'HOTSPOT_LOCKED'
    );
    state = read(send(state, 'INSPECT', { hotspotId: 'invitation' }));
    const invitationRead = state;
    assert.equal(publicView(state).exploration.recommendedHotspotId, 'curator');
    assert.deepEqual(restoreGame(saveGame(state).record).state, state);
    state = send(state, 'INSPECT', { hotspotId: 'curator' });
    while (state.position < state.segment.length - 1) state = send(state, 'NEXT');
    assert.equal(publicView(state).canContinue, false);
    state = send(state, 'NEXT');
    assert.equal(publicView(state).canContinue, true);
    assert.equal(publicView(state).exploration.canChoose, false);
    assert.equal(publicView(state).exploration.primaryAction.kind, 'continue');
    assert.equal(publicView(state).nextScene.title, '제1 전시실');
    assert.equal(state.history.length, 0);
    assert.deepEqual(state.flags, INITIAL_FLAGS);

    state = send(state, 'CONTINUE');
    const travelling = state;
    assert.equal(state.phase, 'travelling');
    assert.equal(state.currentRoomId, 'foyer');
    assert.equal(publicView(state).travel.toRoomId, 'gallery');
    assert.equal(publicView(state).travel.companion, 'yunseo');
    assert.equal(publicView(state).exploration, null);
    assert.deepEqual(state.messages, []);
    assert.deepEqual(restoreGame(saveGame(state).record).state, state);
    state = read(state);
    assert.equal(state.sceneId, 'S01');
    assert.equal(publicView(state).title, '제1 전시실');
    assert.doesNotMatch(publicView(state).exploration.objective, /빈|사라진/);
    assert.deepEqual(
      publicView(state).exploration.hotspots.map(({ id }) => id),
      ['case']
    );
    assert.equal(event(state, 'SKIP_INTRO').error.code, 'INTRO_UNAVAILABLE');
    assert.equal(
      event(state, 'INSPECT', { hotspotId: 'schedule' }).error.code,
      'HOTSPOT_LOCKED'
    );
    state = read(send(state, 'INSPECT', { hotspotId: 'case' }));
    assert.ok(state.messages.some(({ text }) => text.startsWith('먼저 보여 드릴 건')));
    state = send(state, 'DEDUCE', { answerId: 'trace' });
    assert.equal(event(state, 'OPEN_CHOICES').error.code, 'INVESTIGATION_INCOMPLETE');
    assert.equal(publicView(state).exploration.recommendedHotspotId, 'trail');
    state = read(send(state, 'INSPECT', { hotspotId: 'trail' }));
    assert.equal(publicView(state).exploration.recommendedHotspotId, 'schedule');
    state = read(send(state, 'INSPECT', { hotspotId: 'schedule' }));
    assert.match(publicView(state).exploration.reason, /내일 아침 9시/);
    assert.equal(publicView(state).exploration.primaryAction.kind, 'choices');
    assert.equal(state.history.length, 0);
    const firstDecision = state;

    for (const beforeSkip of [initial, invitationRead, travelling]) {
      const skipped = send(beforeSkip, 'SKIP_INTRO');
      assert.equal(skipped.sceneId, 'S01');
      assert.equal(skipped.currentRoomId, 'gallery');
      assert.deepEqual(skipped.investigation.visited, []);
      assert.deepEqual(skipped.flags, INITIAL_FLAGS);
      assert.equal(skipped.history.length, 0);
      assert.deepEqual(restoreGame(saveGame(skipped).record).state, skipped);
    }
    let previous = read(createGame(1, { mode: 'map', storyVersion: 'museum-map-3' }).state);
    assert.equal(previous.sceneId, 'S01');
    assert.equal(previous.currentRoomId, 'gallery');
    assert.equal(event(previous, 'SKIP_INTRO').error.code, 'INTRO_UNAVAILABLE');
    previous = read(send(previous, 'INSPECT', { hotspotId: 'case' }));
    previous = send(previous, 'DEDUCE', { answerId: 'trace' });
    assert.equal(publicView(previous).exploration.canChoose, true);
    assert.deepEqual(restoreGame(saveGame(previous).record).state, previous);
    for (const [choiceId, sceneId, roomId, discovery] of [
      ['A', 'I01', 'maintenance', '도망에 관한 기능은 없습니다.'],
      ['B', 'I02', 'archive', '서류철 표제의 모서리가 들려 있다.'],
      ['C', 'I03', 'garden', '진한 물자국은 반환실 쪽 복도에서 시작한다.'],
      ['D', 'I04', 'office', '닳은 꼬리표 하나에'],
    ]) {
      const priorResult = send(send(previous, 'OPEN_CHOICES'), 'CHOOSE', { choiceId });
      assert.ok(
        priorResult.segment.some(({ text }) => text.includes(discovery)),
        choiceId
      );
      const result = send(send(firstDecision, 'OPEN_CHOICES'), 'CHOOSE', { choiceId });
      assert.equal(result.segment.length, 1, `${choiceId}: only the departure decision`);
      assert.equal(result.history.length, 1);
      assert.deepEqual(result.flags, priorResult.flags);
      for (const message of priorResult.segment)
        assert.equal(
          publicView(result).messages.some(({ text }) => text === message.text),
          false,
          `${choiceId}: destination discovery must wait for arrival`
        );
      const walking = send(result, 'CONTINUE');
      assert.equal(walking.sceneId, sceneId);
      assert.equal(publicView(walking).travel.toRoomId, roomId);
      assert.deepEqual(publicView(walking).messages, []);
      assert.deepEqual(restoreGame(saveGame(walking).record).state, walking);
      const arrived = read(walking);
      assert.deepEqual(
        arrived.segment.slice(0, priorResult.segment.length),
        priorResult.segment,
        `${choiceId}: preserve every original result message after arrival`
      );
      assert.deepEqual(arrived.investigation.visited, []);
      assert.deepEqual(arrived.flags, result.flags);
      assert.equal(arrived.history.length, 1);
      const priorArrival = read(send(read(priorResult), 'CONTINUE'));
      assert.equal(
        priorArrival.messages.some(({ text }) => text.includes(discovery)),
        false,
        `${choiceId}: the earlier map version keeps its original reveal order`
      );
    }
    for (const mode of ['legacy', 'investigation']) {
      const old = createGame(1, { mode }).state;
      assert.equal(old.sceneId, 'S01');
      assert.deepEqual(restoreGame(saveGame(old).record).state, old);
    }
  }
);

test(
  'three reviewed routes keep eleven decisions and their resources while observations persist across rooms and replay',
  options,
  () => {
    let teamId = 1;
    for (const [name, example] of Object.entries(examples.tabletop_examples)) {
      const transcript = [];
      const state = read(follow(example.route, teamId++, undefined, undefined, transcript));
      transcript.push(...state.messages);
      assert.deepEqual(
        transcript
          .filter(({ text }) =>
            /[ABCD](?:를|는) |모든 팀이|안내원을 고른다고|전력이 남았거나/.test(text)
          )
          .map(({ text }) => text),
        [],
        `${name}: actual dialogue describes actions and the played outcome`
      );
      assert.equal(state.phase, 'terminal', name);
      assert.equal(publicView(state).travel, null, 'endings stay in the final room');
      assert.equal(
        event(state, 'ARRIVE', { roomId: state.currentRoomId }).error.code,
        'GAME_FINISHED'
      );
      assert.equal(state.sceneId, example.route.match(/→ (E\d)$/)[1], name);
      assert.equal(state.history.length, 11, name);
      assert.deepEqual(
        Object.keys(INITIAL_FLAGS)
          .filter((key) => state.flags[key] === true)
          .sort(),
        example.flags,
        name
      );
      for (const key of ['boat', 'record', 'moro'])
        assert.equal(state.flags[key], example[key], name);
      assert.ok(
        publicView(state).observations.some(
          (item) => item.sceneId === 'S01' && item.id === 'case'
        )
      );
      assert.equal(
        new Set(state.observations.map((item) => `${item.sceneId}:${item.id}`)).size,
        state.observations.length
      );
      const restored = restoreGame(JSON.parse(JSON.stringify(saveGame(state).record)));
      assert.equal(restored.ok, true, JSON.stringify(restored.error));
      assert.deepEqual(restored.state, state, name);
      assert.deepEqual(restored.effects, []);
    }
  }
);

test(
  'map travel withholds room dialogue until valid arrival and restores both travelling and prior investigation saves',
  options,
  () => {
    const state = follow('S01.A');
    const view = publicView(state);
    assert.equal(view.mode, 'map');
    assert.equal(view.storyVersion, 'museum-map-4');
    assert.equal(state.phase, 'travelling');
    assert.equal(state.position, 0);
    assert.equal(view.currentRoomId, 'gallery');
    assert.deepEqual(view.travel, {
      fromRoomId: 'gallery',
      toRoomId: 'maintenance',
      fromLabel: '제1 전시실',
      toLabel: '정비 통로',
    });
    assert.deepEqual(view.messages, []);
    assert.equal(view.exploration, null);
    assert.equal(view.npc, null);
    assert.equal(view.canNext, false);
    assert.equal(JSON.stringify(view).includes(state.segment[0].text), false);
    for (const [type, fields] of [
      ['NEXT', {}],
      ['CHOOSE', { choiceId: 'A' }],
      ['INSPECT', { hotspotId: 'receipt' }],
    ])
      assert.equal(event(state, type, fields).error.code, 'EVENT_NOT_ALLOWED', type);
    assert.equal(event(state, 'ARRIVE', { roomId: 'office' }).error.code, 'WRONG_ROOM');
    assert.equal(
      event(state, 'ARRIVE', { roomId: 'maintenance', revision: state.revision - 1 }).error
        .code,
      'STALE_EVENT'
    );
    const restored = restoreGame(JSON.parse(JSON.stringify(saveGame(state).record)));
    assert.equal(restored.ok, true, JSON.stringify(restored.error));
    assert.deepEqual(restored.state, state);
    assert.deepEqual(restored.effects, []);
    const arrived = send(restored.state, 'ARRIVE', { roomId: 'maintenance' });
    assert.equal(arrived.currentRoomId, 'maintenance');
    assert.equal(arrived.phase, 'reading');
    assert.equal(publicView(arrived).travel, null);
    assert.equal(arrived.messages.length, 1);
    assert.equal(arrived.messages[0].text, state.segment[0].text);
    assert.equal(
      event(arrived, 'ARRIVE', { roomId: 'maintenance' }).error.code,
      'EVENT_NOT_ALLOWED'
    );

    const sameRoom = follow('S01.A I01.A P11.A S12.A');
    assert.equal(sameRoom.sceneId, 'T21');
    assert.equal(sameRoom.currentRoomId, 'return');
    assert.equal(sameRoom.phase, 'reading');
    assert.equal(publicView(sameRoom).travel, null);

    const previous = follow('S01.A', 1, 'investigation');
    assert.equal(previous.phase, 'reading');
    assert.equal(previous.currentRoomId, 'maintenance');
    assert.equal(publicView(previous).storyVersion, 'museum-play-2');
    assert.equal(publicView(previous).travel, null);
    assert.deepEqual(restoreGame(saveGame(previous).record).state, previous);

    const facilityRoute = 'S01.B I02.A P11.C S12.D T22.C';
    for (const storyVersion of ['museum-map-4', 'museum-map-3']) {
      const guided = storyVersion === 'museum-map-4';
      const facility = investigate(follow(facilityRoute, 1, 'map', storyVersion));
      for (const choiceId of ['B', 'D']) {
        const result = read(send(send(facility, 'OPEN_CHOICES'), 'CHOOSE', { choiceId }));
        assert.equal(result.currentRoomId, 'garden');
        assert.equal(result.nextSceneId, 'S22');
        assert.equal(result.flags[choiceId === 'B' ? 'battery' : 'repair'], true);
        assert.match(
          result.messages.at(-1).text,
          guided ? /반환실 앞으로 (돌아)?가기로 한다/ : /반환실 (앞으로 돌아간다|앞에 모인다)/,
          `${storyVersion} D22-${choiceId}: describe departure before the walk`
        );
        assert.equal(send(result, 'CONTINUE').phase, 'travelling');
      }

      let contact = read(
        follow(`${facilityRoute} D22.D S22.B P21.C R32.B`, 1, 'map', storyVersion)
      );
      const contactFlags = contact.flags;
      assert.equal(contact.currentRoomId, 'reception');
      assert.deepEqual(
        publicView(contact).exploration.hotspots.map(({ id }) => id),
        guided ? ['report'] : ['report', 'promise', 'consent']
      );
      if (guided) {
        assert.equal(
          event(contact, 'INSPECT', { hotspotId: 'consent' }).error.code,
          'HOTSPOT_LOCKED'
        );
        contact = send(send(contact, 'INSPECT', { hotspotId: 'report' }), 'EXPLORE');
        assert.equal(
          event(contact, 'INSPECT', { hotspotId: 'promise' }).error.code,
          'HOTSPOT_LOCKED'
        );
      } else {
        assert.equal(event(contact, 'INSPECT', { hotspotId: 'consent' }).ok, true);
      }
      contact = read(send(contact, 'INSPECT', { hotspotId: 'report' }));
      assert.equal(publicView(contact).exploration.recommendedHotspotId, 'promise');
      if (guided)
        assert.equal(
          event(contact, 'INSPECT', { hotspotId: 'consent' }).error.code,
          'HOTSPOT_LOCKED'
        );
      contact = read(send(contact, 'INSPECT', { hotspotId: 'promise' }));
      assert.equal(publicView(contact).exploration.recommendedHotspotId, 'consent');
      assert.equal(
        contact.messages.find(({ text }) => text.startsWith('수령인과 주소가 접수 기록에'))
          .text,
        guided
          ? '수령인과 주소가 접수 기록에 나란히 표시된다. 여러분은 나래에게 수령 정보를 확인했다는 답장을 보낸다.'
          : '수령인과 주소가 접수 기록에 나란히 표시된다. 모든 팀이 이 확인을 마친다. 앞서 다른 자료를 골랐다고 주소를 얻지 못하는 일은 없다.'
      );
      contact = read(send(contact, 'INSPECT', { hotspotId: 'consent' }));
      assert.equal(publicView(contact).exploration.canChoose, true);
      assert.deepEqual(contact.flags, contactFlags);
      assert.deepEqual(restoreGame(saveGame(contact).record).state, contact);
      const departure = read(send(send(contact, 'OPEN_CHOICES'), 'CHOOSE', { choiceId: 'C' }));
      assert.equal(departure.currentRoomId, 'reception');
      assert.match(
        departure.messages.at(-1).text,
        guided ? /정비 통로로 가기로 한다/ : /모로가 놓인 곳으로 돌아간다/
      );
      if (guided) assert.doesNotMatch(departure.messages.at(-1).text, /처음 따라왔던/);
      const transport = read(send(departure, 'CONTINUE'));
      assert.equal(transport.currentRoomId, 'maintenance');
      assert.match(transport.messages[0].text, guided ? /^정비 통로의/ : /^반환실 앞에/);
    }
  }
);

test(
  'incomplete inspection cannot unlock a choice, and wrong deductions and repeated inspection preserve resources',
  options,
  () => {
    let state = read(createGame(1, { mode: 'map', storyVersion: 'museum-map-3' }).state);
    assert.ok(
      publicView(state).exploration.hotspots.every((item) => !Object.hasOwn(item, 'messages'))
    );
    assert.equal(publicView(state).exploration.deduction, null);
    assert.doesNotMatch(JSON.stringify(publicView(state)), /깨지지 않은 유리|유리를 깨뜨려/);
    assert.equal(event(state, 'OPEN_CHOICES').error.code, 'INVESTIGATION_INCOMPLETE');
    state = send(state, 'INSPECT', { hotspotId: 'case' });
    assert.ok(publicView(state).canNext, 'case must have unread observation text');
    const restored = restoreGame(saveGame(state).record);
    assert.equal(restored.ok, true);
    assert.deepEqual(restored.state, state, 'mid-inspection replay');
    state = send(state, 'EXPLORE');
    assert.deepEqual(state.investigation.visited, []);
    assert.deepEqual(state.observations, []);
    assert.equal(event(state, 'OPEN_CHOICES').error.code, 'INVESTIGATION_INCOMPLETE');
    assert.equal(
      event(state, 'DEDUCE', { answerId: 'trace' }).error.code,
      'DEDUCTION_NOT_READY'
    );
    state = read(send(state, 'INSPECT', { hotspotId: 'case' }));
    assert.equal(state.observations.length, 1);
    assert.match(publicView(state).exploration.deduction.prompt, /깨지지 않은 유리/);
    state = send(state, 'DEDUCE', { answerId: 'broken' });
    assert.equal(state.investigation.deductionSolved, false);
    assert.ok(state.investigation.feedback);
    assert.deepEqual(state.flags, INITIAL_FLAGS);
    assert.equal(state.history.length, 0);
    assert.equal(event(state, 'OPEN_CHOICES').error.code, 'INVESTIGATION_INCOMPLETE');
    state = read(send(state, 'INSPECT', { hotspotId: 'case' }));
    assert.equal(
      state.observations.length,
      1,
      'repeat observation cannot duplicate a notebook entry'
    );
    assert.equal(state.investigation.observations.length, 1);
    state = send(state, 'DEDUCE', { answerId: 'trace' });
    assert.equal(publicView(state).exploration.canChoose, true);
    assert.ok(
      publicView(state).exploration.hotspots.some((item) => !item.visited),
      'optional objects remain optional'
    );
    state = send(state, 'OPEN_CHOICES');
    assert.equal(publicView(state).choices.length, 4);
    assert.equal(send(state, 'BACK').phase, 'exploring');

    for (const [route, clue] of [
      ['S01.A I01.A', '종과 물결 사이에는 도장이 정확히 하나 있다.'],
      ['S01.A I01.B', '기록실 → 반환실 구간은 침수로 통행할 수 없습니다.'],
      ['S01.A I01.B P12.B S12.A T21.D D22.A S22.B', '유입 차단 뒤 레일을 고정한다.'],
    ]) {
      let puzzleState = read(follow(route));
      const hiddenView = publicView(puzzleState);
      assert.equal(hiddenView.exploration.puzzle, null, puzzleState.sceneId);
      assert.equal(JSON.stringify(hiddenView).includes(clue), false, puzzleState.sceneId);
      assert.doesNotMatch(JSON.stringify(hiddenView), /"instructions"|"nodes"|"edges"/);
      const required = observations[puzzleState.sceneId];
      for (const [index, hotspotId] of required.entries()) {
        puzzleState = read(send(puzzleState, 'INSPECT', { hotspotId }));
        if (index < required.length - 1)
          assert.equal(
            publicView(puzzleState).exploration.puzzle,
            null,
            'all required observations must finish'
          );
      }
      assert.ok(publicView(puzzleState).exploration.puzzle.instructions.includes(clue));
      if (puzzleState.sceneId === 'P12') {
        assert.ok(publicView(puzzleState).exploration.puzzle.nodes.length);
        assert.ok(publicView(puzzleState).exploration.puzzle.edges.length);
      }
    }
  }
);

test(
  'S22 reveals the original promise before the admission and rescue, even when later hotspot IDs are submitted directly',
  options,
  () => {
    const prefix = 'S01.A I01.B P12.B S12.A T21.D D22.A';
    let state = read(follow(prefix));
    assert.equal(state.sceneId, 'S22');
    const before = state.flags;
    const unlocked = ['story'];
    assert.deepEqual(
      publicView(state).exploration.hotspots.map(({ id }) => id),
      unlocked
    );
    assert.doesNotMatch(publicView(state).exploration.blockedReason, /윤서의 인정|격벽 너머/);
    assert.equal(event(state, 'INSPECT', { hotspotId: 'rescue' }).error.code, 'HOTSPOT_LOCKED');
    for (const [current, next] of [
      ['story', 'request'],
      ['request', 'rescue'],
    ]) {
      assert.equal(event(state, 'INSPECT', { hotspotId: next }).error.code, 'HOTSPOT_LOCKED');
      state = send(state, 'INSPECT', { hotspotId: current });
      state = send(state, 'EXPLORE');
      assert.equal(event(state, 'INSPECT', { hotspotId: next }).error.code, 'HOTSPOT_LOCKED');
      state = send(state, 'INSPECT', { hotspotId: current });
      while (state.position < state.segment.length - 1) state = send(state, 'NEXT');
      assert.deepEqual(
        publicView(state).exploration.hotspots.map(({ id }) => id),
        unlocked
      );
      assert.equal(event(state, 'INSPECT', { hotspotId: next }).error.code, 'HOTSPOT_LOCKED');
      state = send(state, 'NEXT');
      unlocked.push(next);
      assert.deepEqual(
        publicView(state).exploration.hotspots.map(({ id }) => id),
        unlocked
      );
    }
    state = read(send(state, 'INSPECT', { hotspotId: 'rescue' }));
    state = send(state, 'DEDUCE', { answerId: 'tomorrow' });
    assert.equal(publicView(state).exploration.canChoose, true);
    assert.deepEqual(state.flags, before);
    assert.deepEqual(restoreGame(saveGame(state).record).state, state);

    assert.equal(
      publicView(state).exploration.hotspots.find(({ id }) => id === 'rescue').anchor,
      'valve'
    );
    assert.match(
      state.investigation.observations.find(({ id }) => id === 'rescue').text,
      /반환실 측 공용 조작반/
    );
    for (const ready of [
      state,
      investigate(follow('S01.A I01.B P12.B S12.A T21.A D21.A')),
      investigate(follow('S01.B I02.A P11.C S12.A T21.A D21.A')),
    ]) {
      assert.ok(ready.messages.some(({ text }) => /안뜰.*같은 배수선/.test(text)));
      const prepared = read(send(send(ready, 'OPEN_CHOICES'), 'CHOOSE', { choiceId: 'C' }));
      assert.equal(prepared.currentRoomId, 'return');
      assert.match(prepared.segment[0].text, /반환실 측 공용 조작반/);
      assert.deepEqual(prepared.flags, {
        ...ready.flags,
        map: true,
        maintenance: ready.flags.maintenance || ready.flags.map,
      });
      assert.equal(prepared.nextSceneId, 'P21');
    }

    const priorMap = investigate(
      follow('S01.B I02.A P11.C S12.A T21.A D21.A', 1, 'map', 'museum-map-3')
    );
    assert.equal(
      publicView(priorMap).exploration.hotspots.find(({ id }) => id === 'rescue').anchor,
      'boat'
    );
    const priorPreparation = read(
      send(send(priorMap, 'OPEN_CHOICES'), 'CHOOSE', { choiceId: 'C' })
    );
    assert.doesNotMatch(priorPreparation.segment[0].text, /반환실 측 공용 조작반/);

    let previous = read(follow(prefix, 1, 'investigation'));
    previous = read(send(previous, 'INSPECT', { hotspotId: 'rescue' }));
    assert.equal(previous.storyVersion, 'museum-play-2');
    assert.deepEqual(restoreGame(saveGame(previous).record).state, previous);
  }
);

test(
  'puzzles accept actual boards, reject malformed submissions, and record the submitted order rather than an unrelated A–D label',
  options,
  () => {
    let stamps = investigate(follow('S01.A I01.A'));
    assert.equal(stamps.sceneId, 'P11');
    const choosing = send(stamps, 'OPEN_CHOICES');
    assert.deepEqual(publicView(choosing).choices, []);
    assert.equal(event(choosing, 'CHOOSE', { choiceId: 'A' }).error.code, 'PUZZLE_REQUIRED');
    assert.equal(
      event(stamps, 'SOLVE', { answer: ['bell', 'bell', 'wave', 'star'] }).error.code,
      'INCOMPLETE_ORDER'
    );
    const answer = ['star', 'wave', 'leaf', 'bell'];
    stamps = read(send(stamps, 'SOLVE', { answer }));
    assert.equal(stamps.history.at(-1).choiceId, 'D');
    assert.deepEqual(stamps.history.at(-1).answer, answer);
    assert.equal(
      publicView(stamps).history.at(-1).label,
      '운송표 복원 제출 · 별 → 물결 → 잎 → 종'
    );
    assert.equal(stamps.flags.map, false);
    assert.match(stamps.segment[0].text, /잎이 종 바로 다음에 있지 않습니다/);
    assert.equal(stamps.nextSceneId, 'S12');
    assert.equal(event(stamps, 'SOLVE', { answer }).error.code, 'EVENT_NOT_ALLOWED');
    assert.equal(publicView(stamps).exploration.canChoose, false);

    const path = investigate(follow('S01.A I01.B'));
    assert.match(path.messages[0].text, /중앙 로비의 시설 단말/);
    assert.match(path.messages[1].text, /시설 장비의 운반 통로/);
    assert.match(path.messages[1].text, /관람 복도와는 다릅니다/);
    assert.equal(
      event(path, 'SOLVE', { answer: ['entrance', 'pump'] }).error.code,
      'INCOMPLETE_PATH'
    );
    const solved = read(send(path, 'SOLVE', { answer: puzzleAnswers.P12.B }));
    assert.equal(solved.flags.map, true);
    assert.equal(solved.nextSceneId, 'S12');
    assert.match(solved.segment[0].text, /최단 운반로/);
    assert.match(solved.segment[1].text, /정비 자료함에서 배수 통로 도면을 확보/);
    assert.match(solved.segment[1].text, /관람 복도로 반환실 앞으로 가기로 합니다/);
    assert.equal(solved.currentRoomId, 'foyer');
    assert.equal(publicView(send(solved, 'CONTINUE')).travel.toRoomId, 'return');
    const incorrect = read(send(path, 'SOLVE', { answer: puzzleAnswers.P12.A }));
    assert.match(incorrect.segment[0].text, /침수된 운반 구간/);
    assert.match(incorrect.segment[1].text, /추가 도면을 얻지 못합니다/);
    assert.match(incorrect.segment[1].text, /관람 복도로 반환실 앞으로 가기로 합니다/);
    assert.equal(
      publicView(solved).history.at(-1).label,
      '침수 구역의 운반 경로 제출 · 입구 → 펌프실 → 반환실'
    );
  }
);

test(
  'T22 evidence topics preserve admission after reinspection without granting a signed statement',
  options,
  () => {
    let state = investigate(follow('S01.C I03.C P11.B S12.C'));
    assert.equal(state.sceneId, 'T22');
    assert.equal(state.activeClaimId, 'no_request');
    const before = state.flags;
    state = read(send(state, 'TOPIC', { topicId: 'receipt' }));
    assert.ok(state.knownFacts.includes('request_received'));
    assert.equal(state.activeClaimId, null);
    const previousMessages = state.messages.length;
    state = read(send(state, 'INSPECT', { hotspotId: 'account' }));
    assert.equal(
      state.messages
        .slice(previousMessages)
        .some((message) => /받은 적 없|받은 연락은 없/.test(message.text)),
      false
    );
    assert.deepEqual(state.flags, before);
    assert.equal(state.flags.statement, false);
    assert.equal(state.investigation.visited.filter((id) => id === 'account').length, 1);
    assert.deepEqual(restoreGame(saveGame(state).record).state, state);
  }
);
