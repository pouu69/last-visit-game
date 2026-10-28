import assert from 'node:assert/strict';
import { createT22, transition, replayT22, LIMITS } from '../src/game-state.mjs';

const created = createT22({ teamId: 1, entryRoute: 'I03', evidence: ['request'], resources: [] });
assert.equal(created.ok, true);
let state = created.state;
const milestones = [];

function dispatch(type, fields = {}) {
  const result = transition(state, { type, teamId: state.teamId, sceneId: state.sceneId, sceneRevision: state.sceneRevision, ...fields });
  assert.equal(result.ok, true, JSON.stringify(result));
  state = result.state;
  return result;
}

function read() {
  for (let count = 0; count <= LIMITS.messagesPerReply; count += 1) {
    if (state.phase !== 'reading' && !(state.phase === 'result' && state.readingPosition < state.segment.length)) return;
    dispatch('NEXT_MESSAGE');
  }
  throw new Error('The demo exceeded the documented message-segment bound.');
}

function mark(label) {
  milestones.push(`| ${label} | ${state.phase} | ${state.knownFacts.join(', ') || '없음'} | ${state.evidence.join(', ')} | ${state.resources.join(', ') || '없음'} |`);
}

read();
for (const topicId of ['interruption', 'finish_explanation', 'movement_order', 'return_request']) {
  dispatch('SELECT_TOPIC', { topicId });
  read();
}
mark('관장이 요청 수신을 부인');
const request = dispatch('SUBMIT_TEXT', { requestId: 'demo-question-1', text: '요청서에 관장님 수신 확인이 있는데요. 못 받았다는 말과 다르잖아요.', evidenceId: 'request' });
assert.equal(request.effects[0].type, 'INTERPRET_TURN');
mark('요청서와 질문 제출');

// A fixed adapter result demonstrates the contract without calling an AI service.
dispatch('RESOLVE_TURN', { requestId: 'demo-question-1', interpretation: { kind: 'challenge', claimId: 'no_request', verdict: 'supported' } });
read();
mark('구두 인정 · 서명은 아직 없음');
assert.equal(state.evidence.includes('statement'), false);

for (const topicId of ['reply_to_nara', 'deadline', 'first_exhibit', 'empty_case', 'explanation', 'records']) {
  dispatch('SELECT_TOPIC', { topicId });
  read();
}
dispatch('OPEN_CHOICES');
dispatch('CONFIRM_CHOICE', { choiceId: 'A' });
read();
mark('A 확정 · 규약 대조와 서명');
dispatch('CONTINUE');
mark('D21 진입 정보 반환');

const record = { storyVersion: state.storyVersion, rulesVersion: state.rulesVersion, entry: state.entry, events: state.journal.map(item => item.event) };
const replay = replayT22(record);
assert.equal(replay.ok, true);
assert.deepEqual(replay.state, state);
assert.deepEqual(replay.effects, []);

console.log([
  '# T22 메시지 플레이 — 상태머신 실행 결과',
  '',
  '> 생성 파일: `node scripts/demo-t22.mjs > artifacts/t22-demo.md`로 재생성한다. 직접 편집하지 않는다.',
  '',
  '이 기록은 구현된 상태 전이 함수를 실행해 생성했다. 플레이어 행동과 판정 결과는 고정 예제이며 실제 참가자 대화나 OpenAI 호출 결과가 아니다. 음성·웹 화면·Three.js는 포함하지 않는다.',
  '',
  `작성된 메시지 ${state.messages.length}개 · 판정 요청 효과 ${state.requests.length}회 · 실제 API 호출 0회 · 다음 장면 ${state.sceneId}.`,
  '',
  ...state.messages.flatMap(message => [`**${message.speaker}** · ${message.text}`, '']),
  '## 상태가 바뀐 지점',
  '',
  '| 행동 | 진행 상태 | 알려진 사실 | 보존 자료 | 장비 |',
  '| --- | --- | --- | --- | --- |',
  ...milestones,
  '',
  `확정 사건 ${state.journal.length}개를 같은 원고·규칙 버전으로 재생해 최종 상태와 메시지 기록이 동일함을 확인했다. 재생 중 외부 요청 효과는 실행하지 않았다.`,
  '',
].join('\n'));
