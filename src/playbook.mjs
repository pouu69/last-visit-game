import { sha256 } from './hash.mjs';
import {
  sceneContent as chapters12,
  resultContent as results12,
} from './content/chapters-12.mjs';
import {
  sceneContent as chapter3,
  resultContent as results3,
  endingContent,
} from './content/chapter-3.mjs';
import { createT22, transition as transitionT22 } from './game-state.mjs';
import { topicFor, responseFor } from './t22-dialogue.mjs';
import { INITIAL_FLAGS, EVIDENCE_IDS, RESOURCE_IDS, applyRoute } from './route-rules.mjs';
import {
  investigationFor, evaluatePuzzle, evaluateDeduction, deductionPresentation,
} from './investigation.mjs';
import { openingContent } from './content/opening.mjs';
import { ROOMS, sceneRoomId } from '../public/museum-map.mjs';

const STORY_VERSIONS = Object.freeze({
  map: 'museum-map-4',
  investigation: 'museum-play-2',
  legacy: 'museum-full-1',
});
const PREVIOUS_MAP_VERSION = 'museum-map-3';
export const STORY_VERSION = STORY_VERSIONS.map;
export const SAVE_VERSION = 1;
export const LIMITS = Object.freeze({
  inputCodePoints: 600,
  aiTurns: 3,
  replyMessages: 8,
  events: 4096,
  saveBytes: 2_000_000,
});
const ENVELOPE = ['type', 'teamId', 'sceneId', 'revision'];
const FIELDS = {
  NEXT: [],
  OPEN_CHOICES: ['fromObservations'],
  BACK: [],
  CHOOSE: ['choiceId'],
  CONTINUE: [],
  HINT: [],
  TOPIC: ['topicId'],
  ASK: ['requestId', 'text', 'evidenceId'],
  AI_RESOLVE: ['requestId', 'interpretation', 'replies'],
  AI_FAIL: ['requestId', 'reason'],
  CANCEL: ['requestId'],
  INSPECT: ['hotspotId', 'resume'],
  EXPLORE: ['preserveReading'],
  DEDUCE: ['answerId'],
  SOLVE: ['answer'],
  ARRIVE: ['roomId'],
  SKIP_INTRO: [],
};
const ALLOWED = {
  travelling: ['ARRIVE', 'SKIP_INTRO'],
  reading: ['NEXT', 'OPEN_CHOICES', 'HINT', 'INSPECT', 'EXPLORE', 'SKIP_INTRO'],
  input: ['TOPIC', 'ASK', 'OPEN_CHOICES', 'HINT', 'INSPECT', 'EXPLORE', 'DEDUCE', 'SOLVE'],
  exploring: [
    'INSPECT',
    'EXPLORE',
    'DEDUCE',
    'SOLVE',
    'OPEN_CHOICES',
    'HINT',
    'TOPIC',
    'ASK',
    'CONTINUE',
    'SKIP_INTRO',
  ],
  choosing: ['BACK', 'CHOOSE', 'HINT', 'INSPECT', 'EXPLORE', 'DEDUCE', 'SOLVE'],
  evaluating: ['AI_RESOLVE', 'AI_FAIL', 'CANCEL', 'OPEN_CHOICES'],
  result: ['NEXT', 'CONTINUE'],
  terminal: [],
};
const T22_TOPICS = [
  'interruption',
  'finish_explanation',
  'movement_order',
  'return_request',
  'receipt',
  'reply_to_nara',
  'deadline',
  'first_exhibit',
  'empty_case',
  'explanation',
  'records',
  'key',
  'key_ownership',
];
const T22_FACTS = ['request_received', 'return_delayed', 'return_clause_removed'];
const FAILURES = ['timeout', 'refusal', 'invalid_output', 'quota', 'network'];
const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOnly = (value, fields) =>
  isRecord(value) &&
  Object.keys(value).length <= fields.length &&
  Object.keys(value).every((key) => fields.includes(key));
const isId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
const failure = (code, message) => ({ ok: false, error: { code, message } });
const owned = (flags, ids) => ids.filter((id) => flags[id]);

function freezeOwned(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) freezeOwned(item);
  return Object.freeze(value);
}

function validText(value, maximum = LIMITS.inputCodePoints) {
  return (
    typeof value === 'string' &&
    value.length <= maximum * 2 &&
    value.trim().length > 0 &&
    Array.from(value).length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  );
}

function contentFor(sceneId, flags, history) {
  const content =
    sceneId === 'O00'
      ? openingContent()
      : /^E[1-6]$/.test(sceneId)
      ? endingContent(sceneId, flags, history)
      : chapters12(sceneId, flags, history) ?? chapter3(sceneId, flags, history);
  if (!content?.messages.length)
    throw new Error(`Scene ${sceneId} has no reviewed manuscript messages.`);
  return content;
}

function reveal(state, template) {
  const knownFacts = [...new Set([...state.knownFacts, ...(template.facts || [])])].sort();
  let activeClaimId = Object.hasOwn(template, 'claimId')
    ? template.claimId
    : state.activeClaimId;
  if (knownFacts.includes('request_received')) activeClaimId = null;
  const message = {
    id: `${state.sceneId}-${state.messages.length + 1}`,
    speaker: template.speaker,
    text: template.text,
  };
  return {
    ...state, knownFacts, activeClaimId, messages: [...state.messages, message],
    ...(Object.hasOwn(state, 'currentMessageId') ? { currentMessageId: null } : {}),
  };
}

function idlePhase(state) {
  if (state.ending) return 'terminal';
  if (state.investigation) return state.content.npc ? 'input' : 'exploring';
  return state.content.npc ? 'input' : 'choosing';
}

function finishReading(state) {
  let next = state;
  const active = state.investigation?.activeHotspot;
  if (active && !state.investigation.visited.includes(active)) {
    const hotspot = state.investigationDefinition.hotspots.find((item) => item.id === active);
    const observation = { id: active, label: hotspot.label, text: hotspot.observation };
    next = {
      ...state,
      observations: [
        ...state.observations,
        { sceneId: state.sceneId, sceneTitle: state.content.title, ...observation },
      ],
      investigation: {
        ...state.investigation,
        visited: [...state.investigation.visited, active],
        observations: [...state.investigation.observations, observation],
      },
    };
  }
  if (next.sceneId === 'O00' && choiceReadiness(next).canChoose)
    next = { ...next, nextSceneId: 'S01' };
  return { ...next, phase: idlePhase(next) };
}

function startSegment(state, segment, phase = 'reading', activeHotspot = null) {
  if (!segment.length)
    throw new Error(`Scene ${state.sceneId} produced an empty ${phase} segment.`);
  let next = reveal(
    {
      ...state,
      segment,
      position: 1,
      phase,
      ...(state.investigation
        ? { investigation: { ...state.investigation, activeHotspot } }
        : {}),
    },
    segment[0]
  );
  if (phase === 'reading' && segment.length === 1) next = finishReading(next);
  return next;
}

function enterScene(state, sceneId) {
  if (Object.hasOwn(state, 'currentMessageId')) {
    const { currentMessageId, ...rest } = state;
    state = rest;
  }
  let content = contentFor(sceneId, state.flags, state.history);
  const ending = /^E[1-6]$/.test(sceneId);
  if (ending && state.storyVersion === STORY_VERSION)
    content = {
      ...content,
      messages: content.messages.map((message) =>
        message.text.startsWith('그날 밤 마지막 확인 당시 모로는 작동하고 있었다.')
          ? {
              ...message,
              text: '그날 밤 마지막 확인 당시 모로는 작동하고 있었다. 보관 위치와 이동 담당자를 인계 기록에 남겼다.',
            }
          : message
      ),
    };
  const targetRoomId = ending ? state.currentRoomId : sceneRoomId(sceneId);
  const investigationDefinition =
    state.mode === 'legacy'
      ? null
      : investigationFor(sceneId, content, state.flags, state.storyVersion === STORY_VERSION);
  const entryRoute =
    state.history.find((entry) => /^I0[1-4]$/.test(entry.sceneId))?.sceneId ?? 'I01';
  let dialogue = null;
  if (sceneId === 'T22') {
    const result = createT22({
      teamId: state.teamId,
      entryRoute,
      stance: state.flags.stance,
      evidence: owned(state.flags, EVIDENCE_IDS),
      resources: owned(state.flags, RESOURCE_IDS),
      knownFacts: state.knownFacts.filter((fact) => T22_FACTS.includes(fact)),
    });
    if (!result.ok)
      throw new Error(`T22 scene entry broke the runtime contract: ${result.error.message}`);
    dialogue = result.state;
  }
  const next = {
    ...state,
    sceneId,
    content,
    ending,
    currentRoomId: state.mode === 'map' ? state.currentRoomId : targetRoomId,
    messages: [],
    activeClaimId: null,
    pendingRequest: null,
    requests: [],
    dialogue,
    hintPosition: 0,
    nextSceneId: null,
    committedChoice: null,
    investigationDefinition,
    investigation: investigationDefinition
      ? {
          visited: [],
          activeHotspot: null,
          observations: [],
          deductionSolved: false,
          feedback: null,
        }
      : null,
  };
  let segment = investigationDefinition ? investigationDefinition.intro : content.messages;
  const previousChoice = state.history.at(-1);
  if (
    state.storyVersion === STORY_VERSION &&
    previousChoice?.sceneId === 'S01' &&
    previousChoice.nextSceneId === sceneId
  ) {
    // Destination discoveries follow ARRIVE; preserve their authored prose and route effects.
    segment = [
      ...results12(
        previousChoice.sceneId,
        previousChoice.choiceId,
        previousChoice.before,
        previousChoice.after,
        state.history
      ),
      ...segment,
    ];
  }
  if (state.mode === 'map' && targetRoomId !== state.currentRoomId) {
    return { ...next, phase: 'travelling', segment, position: 0 };
  }
  return startSegment(next, segment);
}

function commit(previous, next, event, effects = []) {
  return freezeOwned({
    ok: true,
    state: {
      ...next,
      revision: previous.revision + 1,
      events: [...previous.events, structuredClone(event)],
    },
    effects,
  });
}

/** Pure session. Callers own no mutable references in returned state. */
export function createGame(teamId, options = {}) {
  if (![1, 2, 3].includes(teamId))
    return failure('INVALID_TEAM', 'teamId는 1, 2, 3 중 하나로 지정해 주세요.');
  if (
    !hasOnly(options, ['mode', 'storyVersion', 'playerName']) ||
    !['legacy', 'investigation', 'map', undefined].includes(options.mode)
  ) {
    return failure(
      'INVALID_MODE',
      'mode는 map, investigation 또는 legacy로 지정해 주세요. 새 게임은 map을 사용합니다.'
    );
  }
  if (
    options.playerName !== undefined &&
    (typeof options.playerName !== 'string' || !/^[가-힣]{2,12}$/.test(options.playerName))
  )
    return failure('INVALID_PLAYER_NAME', '닉네임은 한글 2~12자로 지정해 주세요.');
  const mode = options.mode ?? 'map';
  const storyVersion = options.storyVersion ?? STORY_VERSIONS[mode];
  if (
    storyVersion !== STORY_VERSIONS[mode] &&
    !(mode === 'map' && storyVersion === PREVIOUS_MAP_VERSION)
  )
    return failure(
      'VERSION_MISMATCH',
      'storyVersion이 mode와 맞지 않습니다. 새 게임은 버전을 생략하고, 저장 복원은 기록의 원래 버전을 사용해 주세요.'
    );
  const firstSceneId = storyVersion === STORY_VERSION ? 'O00' : 'S01';
  const state = enterScene(
    {
      storyVersion,
      mode,
      currentRoomId: sceneRoomId(firstSceneId),
      teamId,
      ...(options.playerName !== undefined ? { playerName: options.playerName } : {}),
      revision: 0,
      flags: { ...INITIAL_FLAGS },
      history: [],
      observations: [],
      knownFacts: [],
      events: [],
    },
    firstSceneId
  );
  return freezeOwned({ ok: true, state, effects: [] });
}

function topicsFor(state) {
  if (!state.content.npc || state.ending) return [];
  if (state.sceneId === 'T22') {
    return T22_TOPICS.flatMap((id) => {
      const topic = topicFor(id, state.knownFacts, state.activeClaimId);
      if (topic.requiresFact && !state.knownFacts.includes(topic.requiresFact)) return [];
      if (topic.evidenceId && !state.flags[topic.evidenceId]) return [];
      return [{ id, label: topic.question }];
    });
  }
  return [
    { id: 'recap', label: '방금 설명한 내용에서 중요한 부분을 다시 알려 주세요.' },
    { id: 'actions', label: '이야기를 들은 뒤에는 어떻게 결정하나요?' },
  ];
}

function fixedTopic(state, topicId) {
  if (topicId === 'actions')
    return [
      {
        speaker: '게임',
        text: '대화와 기록을 확인한 뒤 A–D 중 하나를 팀의 행동으로 확정해 주세요. 물건을 받거나 다음 장소로 가는 일은 그때 진행됩니다.',
      },
    ];
  if (topicId !== 'recap') return null;
  const speaker = state.content.npc === 'moro' ? '모로' : '나래';
  const replies = state.messages.filter((message) => message.speaker === speaker).slice(-3);
  return replies.length
    ? replies.map(({ speaker: name, text }) => ({ speaker: name, text }))
    : [
        {
          speaker: '게임',
          text: '아직 이 인물에게 들은 설명이 없습니다. 장면의 메시지를 읽거나 A–D 행동을 확인해 주세요.',
        },
      ];
}

function t22Transition(state, event) {
  const types = {
    TOPIC: 'SELECT_TOPIC',
    ASK: 'SUBMIT_TEXT',
    AI_RESOLVE: 'RESOLVE_TURN',
    AI_FAIL: 'FAIL_TURN',
    CANCEL: 'CANCEL_TURN',
  };
  const shadow = {
    ...state.dialogue,
    phase: state.phase === 'exploring' ? 'input' : state.phase,
    knownFacts: state.knownFacts.filter((fact) => T22_FACTS.includes(fact)),
    activeClaimId: state.activeClaimId,
    messages: [],
    segment: [],
    readingPosition: 0,
    journal: [],
    evidence: owned(state.flags, EVIDENCE_IDS),
    resources: owned(state.flags, RESOURCE_IDS),
  };
  const mapped = {
    type: types[event.type],
    teamId: state.teamId,
    sceneId: 'T22',
    sceneRevision: 1,
  };
  for (const field of FIELDS[event.type])
    if (field !== 'replies' && Object.hasOwn(event, field)) mapped[field] = event[field];
  return transitionT22(shadow, mapped);
}

function finishRequest(state, status) {
  return {
    ...state,
    pendingRequest: null,
    requests: state.requests.map((request) =>
      request.requestId === state.pendingRequest.requestId ? { ...request, status } : request
    ),
  };
}

function validReplies(replies, npc) {
  if (replies === undefined) return true;
  const speaker = { moro: '모로', yunseo: '윤서', nara: '나래' }[npc];
  return (
    Array.isArray(replies) &&
    replies.length <= LIMITS.replyMessages &&
    replies.every(
      (reply) =>
        hasOnly(reply, ['speaker', 'text']) &&
        reply.speaker === speaker &&
        validText(reply.text)
    )
  );
}

function hotspotAvailable(state, hotspot) {
  // Prior investigation saves preserve their original free inspection order.
  return (
    state.mode !== 'map' ||
    hotspot.requires.every((id) => state.investigation.visited.includes(id))
  );
}

function canSkipIntro(state) {
  return (
    state.storyVersion === STORY_VERSION &&
    (state.sceneId === 'O00' ||
      (state.sceneId === 'S01' && state.phase === 'travelling' && state.history.length === 0))
  );
}

function choiceReadiness(state) {
  if (!state.investigation) return { canChoose: true, blockedReason: null };
  const definition = state.investigationDefinition;
  const missing = definition.required.filter((id) => !state.investigation.visited.includes(id));
  if (missing.length) {
    const labels = missing
      .map((id) => definition.hotspots.find((item) => item.id === id))
      .filter((hotspot) => hotspotAvailable(state, hotspot))
      .map((hotspot) => hotspot.label);
    return {
      canChoose: false,
      blockedReason: `${labels.join(', ')}의 관찰을 끝까지 확인해 주세요.`,
    };
  }
  if (definition.deduction && !state.investigation.deductionSolved) {
    return { canChoose: false, blockedReason: '관찰한 단서를 대조해 추리를 마쳐 주세요.' };
  }
  return { canChoose: true, blockedReason: null };
}

function isFirstInvestigation(state) {
  return state.mode === 'map' && state.storyVersion === STORY_VERSION && state.sceneId === 'S01';
}

function canPlanInvestigation(state) {
  return isFirstInvestigation(state) && ['exploring', 'input'].includes(state.phase) &&
    state.committedChoice === null && state.investigationDefinition.required.every(
      (id) => state.investigation.visited.includes(id)
    );
}

function commitChoice(state, choiceId, event, puzzleResult = null) {
  const before = state.flags;
  const { flags, nextSceneId } = applyRoute(state.sceneId, choiceId, before);
  const entry = { sceneId: state.sceneId, choiceId, before, after: flags, nextSceneId };
  if (puzzleResult) {
    const puzzle = state.investigationDefinition.puzzle;
    const pieces = puzzle.kind === 'path' ? puzzle.nodes : puzzle.pieces;
    entry.label = `${puzzle.title} 제출 · ${event.answer
      .map((id) => pieces.find((piece) => piece.id === id).label)
      .join(' → ')}`;
    entry.answer = [...event.answer];
  }
  const history = [...state.history, entry];
  let segment;
  if (state.storyVersion === STORY_VERSION && state.sceneId === 'S01') {
    segment = [
      {
        speaker: '서술',
        text: {
          A: '모로의 바퀴 자국을 따라 정비 통로로 가서 젖은 종이 조각을 확인하기로 한다.',
          B: '제1호의 기증 기록을 확인하기 위해 안내지를 들고 기록실로 가기로 한다.',
          C: '전시실 뒤의 물자국이 어디서 이어지는지 확인하러 안뜰로 가기로 한다.',
          D: '윤서에게 반환실 열쇠와 관련 기록을 보여 달라고 요청하고 관장실로 가기로 한다.',
        }[choiceId],
      },
    ];
  } else if (puzzleResult) {
    let consequence;
    if (state.sceneId === 'P21') {
      consequence = puzzleResult.correct
        ? '안전 순서가 승인되어 자동 인양 모드를 사용할 수 있습니다. 아직 함을 움직이거나 전원을 쓰지는 않았습니다. 다음에는 실제 구조 방법을 정합니다.'
        : '안전 인터록이 자동 인양 모드를 잠갔습니다. 아직 배나 장부의 손상이 결정된 것은 아닙니다. 다음에는 가능한 수동 복구 방법을 정합니다.';
    } else if (state.sceneId === 'P12') {
      const acquisition = puzzleResult.correct
        ? before.map
          ? '이미 가진 배수 통로 도면과 자료함의 도면을 대조합니다. 같은 도면이 추가로 생기지는 않습니다.'
          : '정비 자료함에서 배수 통로 도면을 확보합니다.'
        : '이번에는 정비 자료함의 추가 도면을 얻지 못합니다. 기존 자료와 장비는 그대로 보존합니다.';
      const departure =
        state.storyVersion === STORY_VERSION
          ? '우리는 관람 복도로 반환실 앞으로 가기로 합니다.'
          : '우리는 관람 복도로 반환실 앞에 합류합니다.';
      consequence = `${acquisition} 검증한 것은 시설 운반로입니다. ${departure}`;
    } else if (puzzleResult.correct) {
      consequence = before.map
        ? '이미 가진 시설 도면을 확인하고 다음 통로로 이동합니다. 같은 도면이 추가로 생기지는 않습니다.'
        : '정비 자료함의 시설 도면을 확보하고 다음 통로로 이동합니다.';
    } else {
      consequence =
        '해설을 확인한 뒤 안내받은 안전한 통로로 이동합니다. 이번에는 추가 도면을 얻지 않으며, 이미 가진 자료와 장비는 그대로 보존합니다.';
    }
    // Arbitrary submitted orders need their own feedback, not an unrelated A–D explanation.
    segment = [
      { speaker: '게임', text: puzzleResult.feedback },
      { speaker: '서술', text: consequence },
    ];
  } else {
    segment =
      results12(state.sceneId, choiceId, before, flags, history) ??
      results3(state.sceneId, choiceId, before, flags, history);
    if (state.storyVersion === STORY_VERSION) {
      const replacements = {
        '배터리를 챙기는 동안 제어기에서 호출 표시가 뜬다. 여러분은 반환실 앞으로 돌아간다.':
          '배터리를 챙기는 동안 제어기에서 호출 표시가 뜬다. 여러분은 반환실 앞으로 돌아가기로 한다.',
        '제어기 호출이 한 번 울린다. 준비물을 들고 반환실 앞에 모인다.':
          '제어기 호출이 한 번 울린다. 준비물을 들고 반환실 앞으로 가기로 한다.',
        '여러분은 모로가 놓인 곳으로 돌아간다. 처음 따라왔던 바퀴가 이번에는 여러분의 행선지를 기다린다.':
          '여러분은 모로의 이동을 맡기 위해 정비 통로로 가기로 한다. 안내원의 바퀴는 이제 여러분이 정할 행선지를 기다린다.',
        '도면을 따라 배수선을 열고 보조 레일의 걸림을 확인한다. 외부 구조를 위한 통로 준비가 끝난다.':
          '반환실 측 공용 조작반의 번호를 도면과 대조한다. 같은 배수선을 열고 보조 레일의 걸림을 확인하자 외부 구조를 위한 통로 준비가 끝난다.',
        '흐릿한 번호와 배관 방향을 대조해 배수선의 위치를 확인한다. 도면을 확보했지만 밸브와 레일 점검은 아직 끝나지 않았다.':
          '반환실 측 공용 조작반의 흐릿한 번호와 배관 방향을 대조해 배수선의 위치를 확인한다. 도면을 확보했지만 밸브와 레일 점검은 아직 끝나지 않았다.',
        '이미 점검한 배수선과 보조 레일을 다시 확인한다. 통로는 준비된 상태를 유지한다.':
          '반환실 측 공용 조작반에서 이미 점검한 같은 배수선과 보조 레일을 다시 확인한다. 통로는 준비된 상태를 유지한다.',
      };
      segment = segment.map((message) =>
        replacements[message.text] ? { ...message, text: replacements[message.text] } : message
      );
    }
  }
  // I04's admission is a shared scene fact, independent of which object is kept.
  const knownFacts =
    state.sceneId === 'I04'
      ? [...new Set([...state.knownFacts, 'request_received'])].sort()
      : state.knownFacts;
  const next = startSegment(
    { ...state, flags, history, knownFacts, committedChoice: choiceId, nextSceneId },
    segment,
    'result'
  );
  return commit(state, next, event);
}

/**
 * Validate one untrusted event, returning a new immutable state or a tagged error.
 * Free AI events are retired; prepared TOPIC dialogue remains available.
 * Rejected events preserve state. Legacy AI is only interpreted by save replay.
 * Contract: ../docs/narrative/runtime-contract.md
 */
export function dispatch(state, event) {
  if (['ASK', 'AI_RESOLVE', 'AI_FAIL', 'CANCEL'].includes(event?.type))
    return failure(
      'AI_DISABLED',
      '자유 AI 대화는 지원하지 않습니다. 준비된 질문이나 현재 장면의 행동을 골라 주세요.'
    );
  return transition(state, event);
}

function transition(state, event) {
  if (
    !isRecord(event) ||
    !Object.hasOwn(FIELDS, event.type) ||
    !hasOnly(event, [...ENVELOPE, ...FIELDS[event.type]])
  ) {
    return failure(
      'INVALID_EVENT',
      'event.type과 필드를 확인해 주세요. 현재 장면에 지원하는 사건만 보낼 수 있습니다.'
    );
  }
  if (event.teamId !== state.teamId)
    return failure(
      'TEAM_MISMATCH',
      'teamId가 현재 팀과 다릅니다. 현재 팀의 사건을 보내 주세요.'
    );
  if (event.sceneId !== state.sceneId || event.revision !== state.revision)
    return failure(
      'STALE_EVENT',
      '장면이나 revision이 바뀌었습니다. 현재 화면을 갱신한 뒤 다시 행동해 주세요.'
    );
  if (state.phase === 'terminal')
    return failure(
      'GAME_FINISHED',
      '모험이 끝났습니다. 기록을 읽거나 새 게임을 시작해 주세요.'
    );
  if (event.type === 'SKIP_INTRO' && !canSkipIntro(state))
    return failure(
      'INTRO_UNAVAILABLE',
      '이 장면은 건너뛸 수 있는 관람 안내가 아닙니다. 현재 조사와 선택을 진행해 주세요.'
    );
  if (!state.investigation && ['INSPECT', 'EXPLORE', 'DEDUCE', 'SOLVE'].includes(event.type)) {
    return failure(
      'INVESTIGATION_UNAVAILABLE',
      '이 기록은 이전 이야기 모드입니다. 현재 화면의 읽기와 선택으로 계속해 주세요.'
    );
  }
  if (!ALLOWED[state.phase].includes(event.type) || (state.ending && event.type !== 'NEXT')) {
    return failure(
      'EVENT_NOT_ALLOWED',
      `${state.phase} 상태에서는 ${event.type}을 사용할 수 없습니다. 화면에 표시된 행동을 골라 주세요.`
    );
  }
  if (state.events.length >= LIMITS.events)
    return failure(
      'EVENT_LIMIT',
      '이 모험의 사건 기록 한도에 도달했습니다. 기록을 저장한 뒤 새 게임을 시작해 주세요.'
    );
  if (
    state.events.length >= LIMITS.events - 700 &&
    ['TOPIC', 'ASK', 'BACK', 'HINT'].includes(event.type)
  ) {
    return failure(
      'DIALOGUE_LIMIT',
      '추가 대화 한도에 도달했습니다. A–D 행동으로 이야기를 마쳐 주세요.'
    );
  }

  if (['TOPIC', 'ASK'].includes(event.type) && !state.content.npc) {
    return failure(
      'NPC_UNAVAILABLE',
      '이 장면에는 자유롭게 질문할 인물이 없습니다. 주변의 조사 지점을 살펴봐 주세요.'
    );
  }

  if (event.type === 'SKIP_INTRO')
    return commit(
      state,
      enterScene({ ...state, currentRoomId: sceneRoomId('S01') }, 'S01'),
      event
    );

  if (event.type === 'ARRIVE') {
    const targetRoomId = sceneRoomId(state.sceneId);
    if (event.roomId !== targetRoomId) {
      const targetRoom = ROOMS.find((room) => room.id === targetRoomId);
      return failure(
        'WRONG_ROOM',
        `roomId가 현재 목적지와 다릅니다. ${targetRoom.label}에 도착한 뒤 조사해 주세요.`
      );
    }
    return commit(
      state,
      startSegment({ ...state, currentRoomId: targetRoomId }, state.segment),
      event
    );
  }

  if (event.type === 'INSPECT') {
    if (Object.hasOwn(event, 'resume') && typeof event.resume !== 'boolean')
      return failure('INVALID_EVENT', 'resume은 true 또는 false여야 합니다.');
    if (!isId(event.hotspotId))
      return failure(
        'INVALID_HOTSPOT',
        'hotspotId는 현재 장면의 조사 지점 ID로 지정해 주세요.'
      );
    const hotspot = state.investigationDefinition.hotspots.find(
      (item) => item.id === event.hotspotId
    );
    if (!hotspot)
      return failure(
        'INVALID_HOTSPOT',
        '현재 장면에 없는 조사 지점입니다. 화면에 표시된 대상을 골라 주세요.'
      );
    if (!hotspotAvailable(state, hotspot)) {
      const prerequisite = state.investigationDefinition.hotspots.find(
        (item) =>
          hotspot.requires.includes(item.id) && !state.investigation.visited.includes(item.id)
      );
      return failure(
        'HOTSPOT_LOCKED',
        `먼저 '${prerequisite.label}'의 마지막 메시지까지 읽어 주세요. 그다음 조사가 열립니다.`
      );
    }
    let messages = hotspot.messages;
    if (state.sceneId === 'T22' && state.knownFacts.includes('request_received')) {
      messages = messages.flatMap((message) =>
        message.speaker === '윤서' &&
        (message.claimId === 'no_request' || /받은 적 없|받은 연락은 없/.test(message.text))
          ? topicFor('return_request', state.knownFacts).replies
          : [message]
      );
    }
    const paused = state.investigation.pausedReadings?.[hotspot.id];
    if (paused) {
      const pausedReadings = { ...state.investigation.pausedReadings };
      delete pausedReadings[hotspot.id];
      state = {
        ...state,
        investigation: { ...state.investigation, pausedReadings },
      };
      // Changed testimony must use the newly authored branch rather than stale prose.
      if (event.resume && !state.investigation.visited.includes(hotspot.id) &&
          JSON.stringify(paused.segment) === JSON.stringify(messages))
        return commit(state, {
          ...state,
          segment: paused.segment,
          position: paused.position,
          currentMessageId: paused.messageId,
          phase: 'reading',
          investigation: { ...state.investigation, activeHotspot: hotspot.id, feedback: null },
        }, event);
    }
    return commit(
      state,
      startSegment(
        {
          ...state,
          investigation: { ...state.investigation, feedback: null },
        },
        messages,
        'reading',
        hotspot.id
      ),
      event
    );
  }

  if (event.type === 'EXPLORE') {
    if (Object.hasOwn(event, 'preserveReading') && typeof event.preserveReading !== 'boolean')
      return failure('INVALID_EVENT', 'preserveReading은 true 또는 false여야 합니다.');
    const active = state.investigation.activeHotspot;
    const pausedReadings =
      event.preserveReading && state.phase === 'reading' && active &&
      !state.investigation.visited.includes(active)
        ? {
            ...state.investigation.pausedReadings,
            [active]: {
              segment: state.segment,
              position: state.position,
              messageId: state.currentMessageId ?? state.messages.at(-1).id,
            },
          }
        : null;
    return commit(
      state,
      {
        ...state,
        phase: 'exploring',
        investigation: {
          ...state.investigation, activeHotspot: null,
          ...(pausedReadings ? { pausedReadings } : {}),
        },
      },
      event
    );
  }

  if (event.type === 'DEDUCE') {
    const deduction = state.investigationDefinition.deduction;
    if (!deduction)
      return failure(
        'NO_DEDUCTION',
        '이 장면에는 별도 추리가 없습니다. 현재 조사나 퍼즐을 진행해 주세요.'
      );
    if (!isId(event.answerId))
      return failure('INVALID_DEDUCTION', 'answerId는 현재 추리의 선택지 ID로 지정해 주세요.');
    if (!deduction.requires.every((id) => state.investigation.visited.includes(id))) {
      return failure(
        'DEDUCTION_NOT_READY',
        '추리에 필요한 관찰을 끝까지 읽은 뒤 단서를 대조해 주세요.'
      );
    }
    const result = evaluateDeduction(state.sceneId, event.answerId);
    if (!result.ok) return result;
    return commit(
      state,
      {
        ...state,
        investigation: {
          ...state.investigation,
          deductionSolved: state.investigation.deductionSolved || result.correct,
          feedback: result.feedback,
        },
      },
      event
    );
  }

  if (event.type === 'SOLVE') {
    if (!state.investigationDefinition.puzzle)
      return failure(
        'NO_PUZZLE',
        '이 장면에는 조작 퍼즐이 없습니다. 관찰을 마친 뒤 팀의 행동을 골라 주세요.'
      );
    const readiness = choiceReadiness(state);
    if (!readiness.canChoose)
      return failure('INVESTIGATION_INCOMPLETE', readiness.blockedReason);
    if (!Array.isArray(event.answer) || event.answer.length > 16 || !event.answer.every(isId)) {
      return failure(
        'INVALID_PUZZLE_ANSWER',
        'answer에는 현재 퍼즐의 조각 또는 경로 ID를 순서대로 최대 16개 넣어 주세요.'
      );
    }
    const result = evaluatePuzzle(state.sceneId, event.answer);
    if (!result.ok) return result;
    return commitChoice(state, result.choiceId, event, result);
  }

  if (event.type === 'NEXT') {
    if (state.position >= state.segment.length)
      return failure(
        'SEGMENT_READ',
        '현재 메시지를 모두 읽었습니다. 표시된 선택 또는 계속 버튼을 사용해 주세요.'
      );
    let next = reveal(state, state.segment[state.position]);
    next = { ...next, position: state.position + 1 };
    if (next.phase === 'reading' && next.position === next.segment.length)
      next = finishReading(next);
    return commit(state, next, event);
  }

  if (event.type === 'OPEN_CHOICES') {
    if (Object.hasOwn(event, 'fromObservations') && typeof event.fromObservations !== 'boolean')
      return failure('INVALID_EVENT', 'fromObservations는 true 또는 false여야 합니다.');
    if (state.sceneId === 'O00')
      return failure(
        'VISIT_NOT_A_DECISION',
        '로비에서는 초대장과 윤서의 안내를 확인해 주세요. 첫 팀의 결정은 제1 전시실 조사 뒤에 합니다.'
      );
    let choiceState = state;
    if (event.fromObservations) {
      if (!canPlanInvestigation(state))
        return failure(
          'OBSERVATION_PLAN_UNAVAILABLE',
          '제1 전시실의 관찰을 마친 뒤 조사 방향을 정할 수 있습니다.'
        );
      // New UI events use the actual route decision; old replayed events keep their quiz gate.
      choiceState = {
        ...state,
        investigation: { ...state.investigation, deductionSolved: true, feedback: null },
      };
    }
    const readiness = choiceReadiness(choiceState);
    if (!readiness.canChoose)
      return failure('INVESTIGATION_INCOMPLETE', readiness.blockedReason);
    const effects = state.pendingRequest
      ? [
          {
            type: 'CANCEL_REQUEST',
            teamId: state.teamId,
            requestId: state.pendingRequest.requestId,
          },
        ]
      : [];
    let next = state.pendingRequest ? finishRequest(choiceState, 'cancelled') : choiceState;
    if (state.pendingRequest && state.dialogue) {
      const cancelled = t22Transition(state, {
        ...event,
        type: 'CANCEL',
        requestId: state.pendingRequest.requestId,
      });
      if (!cancelled.ok) return cancelled;
      next = { ...next, dialogue: cancelled.state };
    }
    return commit(state, { ...next, phase: 'choosing' }, event, effects);
  }

  if (event.type === 'BACK') {
    if (state.investigation) {
      return commit(
        state,
        {
          ...state,
          phase: 'exploring',
          investigation: { ...state.investigation, activeHotspot: null },
        },
        event
      );
    }
    return commit(
      state,
      { ...state, phase: state.position < state.segment.length ? 'reading' : idlePhase(state) },
      event
    );
  }

  if (event.type === 'CHOOSE') {
    if (state.investigationDefinition?.puzzle)
      return failure(
        'PUZZLE_REQUIRED',
        '이 장면에서는 조각이나 경로를 직접 조합한 뒤 제출해 주세요. A–D 버튼으로 대신 결정할 수 없습니다.'
      );
    const readiness = choiceReadiness(state);
    if (!readiness.canChoose)
      return failure('INVESTIGATION_INCOMPLETE', readiness.blockedReason);
    if (!['A', 'B', 'C', 'D'].includes(event.choiceId))
      return failure(
        'INVALID_CHOICE',
        'choiceId는 현재 장면의 A, B, C, D 중 하나로 지정해 주세요.'
      );
    return commitChoice(state, event.choiceId, event);
  }

  if (event.type === 'CONTINUE') {
    if (state.sceneId === 'O00') {
      if (!choiceReadiness(state).canChoose || state.nextSceneId !== 'S01')
        return failure(
          'VISIT_INCOMPLETE',
          '초대장과 윤서의 안내를 마지막 메시지까지 읽은 뒤 함께 이동해 주세요.'
        );
    } else if (state.phase !== 'result') {
      return failure(
        'EVENT_NOT_ALLOWED',
        '현재 장면에서는 바로 이동할 수 없습니다. 조사와 팀의 행동을 먼저 결정해 주세요.'
      );
    }
    if (state.position < state.segment.length)
      return failure(
        'RESULT_UNREAD',
        '아직 읽지 않은 결과가 있습니다. 다음 메시지로 결과를 확인해 주세요.'
      );
    return commit(state, enterScene(state, state.nextSceneId), event);
  }

  if (event.type === 'HINT') {
    if (state.hintPosition >= state.content.hints.length)
      return failure(
        'NO_HINT',
        '이 장면에서 더 공개할 힌트가 없습니다. 현재 단서와 선택지를 확인해 주세요.'
      );
    return commit(state, { ...state, hintPosition: state.hintPosition + 1 }, event);
  }

  if (event.type === 'TOPIC') {
    if (!topicsFor(state).some((topic) => topic.id === event.topicId))
      return failure(
        'INVALID_TOPIC',
        'topicId가 현재 질문 목록에 없습니다. 표시된 고정 질문을 골라 주세요.'
      );
    if (state.messages.length >= 220)
      return failure(
        'DIALOGUE_LIMIT',
        '이 장면의 대화 한도에 도달했습니다. A–D 행동으로 계속해 주세요.'
      );
    if (state.sceneId === 'T22') {
      const response = t22Transition(state, event);
      if (!response.ok) return response;
      return commit(
        state,
        startSegment({ ...state, dialogue: response.state }, response.state.segment),
        event
      );
    }
    const topic = topicsFor(state).find((item) => item.id === event.topicId);
    return commit(
      state,
      startSegment(state, [
        { speaker: '팀', text: topic.label },
        ...fixedTopic(state, event.topicId),
      ]),
      event
    );
  }

  if (event.type === 'ASK') {
    if (
      !isId(event.requestId) ||
      !validText(event.text) ||
      (event.evidenceId !== null && !EVIDENCE_IDS.includes(event.evidenceId))
    ) {
      return failure(
        'INVALID_INPUT',
        'requestId는 영문·숫자·밑줄·하이픈 1~64자, text는 1~600자, evidenceId는 자료 ID 또는 null로 지정해 주세요.'
      );
    }
    if (event.evidenceId && !state.flags[event.evidenceId])
      return failure(
        'EVIDENCE_NOT_OWNED',
        `${event.evidenceId} 자료를 보유하지 않았습니다. 가진 자료를 선택하거나 자료 없이 질문해 주세요.`
      );
    const previous = state.requests.find((request) => request.requestId === event.requestId);
    if (previous)
      return failure(
        'REQUEST_ID_USED',
        '이미 사용한 requestId입니다. 현재 답변을 확인하거나 새 질문 ID를 사용해 주세요.'
      );
    if (state.requests.length >= LIMITS.aiTurns)
      return failure(
        'TURN_LIMIT',
        '이 장면의 AI 질문 세 번을 사용했습니다. 고정 질문이나 A–D 행동으로 계속해 주세요.'
      );
    if (state.messages.length >= 220)
      return failure(
        'DIALOGUE_LIMIT',
        '이 장면의 대화 한도에 도달했습니다. A–D 행동으로 계속해 주세요.'
      );
    const normalized = { ...event, text: event.text.trim() };
    let dialogue = state.dialogue;
    if (state.sceneId === 'T22') {
      const response = t22Transition(state, normalized);
      if (!response.ok) return response;
      dialogue = response.state;
    }
    const request = {
      requestId: event.requestId,
      text: normalized.text,
      evidenceId: event.evidenceId,
      claimId: state.activeClaimId,
      status: 'pending',
    };
    const next = reveal(
      {
        ...state,
        dialogue,
        phase: 'evaluating',
        pendingRequest: request,
        requests: [...state.requests, request],
      },
      { speaker: '팀', text: normalized.text }
    );
    const effect = {
      type: 'AI_REQUEST',
      teamId: state.teamId,
      sceneId: state.sceneId,
      revision: state.revision + 1,
      requestId: request.requestId,
      text: request.text,
      evidenceId: request.evidenceId,
      claimId: request.claimId,
      npc: state.content.npc,
      knownFacts: [...state.knownFacts],
      evidence: owned(state.flags, EVIDENCE_IDS),
      resources: owned(state.flags, RESOURCE_IDS),
      messages: state.messages.map(({ speaker, text }) => ({ speaker, text })),
    };
    return commit(state, next, normalized, [effect]);
  }

  if (!isId(event.requestId) || state.pendingRequest?.requestId !== event.requestId)
    return failure(
      'STALE_REQUEST',
      'requestId가 대기 중인 질문과 다릅니다. 취소되거나 처리된 답변은 다시 적용할 수 없습니다.'
    );

  if (event.type === 'CANCEL') {
    let next = finishRequest(state, 'cancelled');
    if (state.sceneId === 'T22') {
      const response = t22Transition(state, event);
      if (!response.ok) return response;
      next = { ...next, dialogue: response.state };
    }
    return commit(state, { ...next, phase: 'input' }, event, [
      { type: 'CANCEL_REQUEST', teamId: state.teamId, requestId: event.requestId },
    ]);
  }

  let normalized = event;
  if (event.type === 'AI_FAIL' && !FAILURES.includes(event.reason))
    return failure(
      'INVALID_FAILURE',
      'reason은 timeout, refusal, invalid_output, quota, network 중 하나로 지정해 주세요.'
    );
  if (
    event.type === 'AI_RESOLVE' &&
    (!validReplies(event.replies, state.content.npc) ||
      (state.sceneId !== 'T22' &&
        (!hasOnly(event.interpretation, ['kind']) || event.interpretation.kind !== 'dialogue')))
  ) {
    normalized = {
      type: 'AI_FAIL',
      teamId: event.teamId,
      sceneId: event.sceneId,
      revision: event.revision,
      requestId: event.requestId,
      reason: 'invalid_output',
    };
  }
  let segment;
  let dialogue = state.dialogue;
  if (state.sceneId === 'T22') {
    const response = t22Transition(state, normalized);
    if (!response.ok) return response;
    dialogue = response.state;
    const mapped = response.state.journal[0].event;
    if (mapped.type === 'FAIL_TURN') {
      normalized = {
        type: 'AI_FAIL',
        teamId: event.teamId,
        sceneId: event.sceneId,
        revision: event.revision,
        requestId: event.requestId,
        reason: mapped.reason,
      };
    }
    segment = [
      ...response.state.segment,
      ...(normalized.type === 'AI_RESOLVE' ? normalized.replies ?? [] : []),
    ];
  } else {
    segment = normalized.type === 'AI_FAIL' ? responseFor('failure') : normalized.replies;
    if (!segment?.length) {
      normalized = {
        type: 'AI_FAIL',
        teamId: event.teamId,
        sceneId: event.sceneId,
        revision: event.revision,
        requestId: event.requestId,
        reason: 'invalid_output',
      };
      segment = responseFor('failure');
    }
  }
  return commit(
    state,
    startSegment(
      {
        ...finishRequest(state, normalized.type === 'AI_FAIL' ? 'failed' : 'resolved'),
        dialogue,
      },
      segment
    ),
    normalized
  );
}

/** Only this projection may cross to the browser; unrevealed prose never does. */
export function publicView(state) {
  const travelling = state.phase === 'travelling';
  const definition = travelling ? null : state.investigationDefinition;
  const readiness = choiceReadiness(state);
  const recommended = definition?.hotspots.find(
    (hotspot) =>
      definition.required.includes(hotspot.id) &&
      !state.investigation.visited.includes(hotspot.id) &&
      hotspotAvailable(state, hotspot)
  );
  const guidance = definition?.guidance?.[recommended?.id ?? 'ready'];
  const deductionDisplay = definition?.deduction
    ? deductionPresentation(state.sceneId, state.messages)
    : null;
  let primaryAction = null;
  if (definition && state.committedChoice === null) {
    if (recommended)
      primaryAction = { kind: 'inspect', label: recommended.label, hotspotId: recommended.id };
    else if (state.sceneId === 'O00')
      primaryAction = { kind: 'continue', label: '윤서와 제1 전시실로' };
    else if (isFirstInvestigation(state))
      primaryAction = { kind: 'choices', label: '조사 방향 정하기' };
    else if (definition.deduction && !state.investigation.deductionSolved)
      primaryAction = { kind: 'deduce', label: deductionDisplay?.actionLabel ?? '추리하기' };
    else if (definition.puzzle)
      primaryAction = { kind: 'puzzle', label: definition.puzzle.title };
    else primaryAction = { kind: 'choices', label: '다음 행동 정하기' };
  }
  let travel = null;
  if (travelling) {
    const from = ROOMS.find((room) => room.id === state.currentRoomId);
    const to = ROOMS.find((room) => room.id === sceneRoomId(state.sceneId));
    travel = { fromRoomId: from.id, toRoomId: to.id, fromLabel: from.label, toLabel: to.label };
    if (state.storyVersion === STORY_VERSION && state.sceneId === 'S01')
      travel.companion = 'yunseo';
  }
  const nextRoomId = state.nextSceneId
    ? sceneRoomId(state.nextSceneId) ?? state.currentRoomId
    : null;
  const nextRoom = ROOMS.find((room) => room.id === nextRoomId);
  const exploration = definition
    ? {
        objective: guidance?.objective ?? definition.objective,
        reason: guidance?.reason ?? null,
        recommendedHotspotId: recommended?.id ?? null,
        primaryAction,
        hotspots: definition.hotspots
          .filter((hotspot) => hotspotAvailable(state, hotspot))
          .map(({ id, label, anchor, kind }) => ({
            id,
            label,
            anchor,
            kind,
            visited: state.investigation.visited.includes(id),
          })),
        activeHotspot: state.investigation.activeHotspot,
        observations: state.investigation.observations,
        canChoose:
          state.sceneId !== 'O00' && readiness.canChoose && state.committedChoice === null,
        canPlanInvestigation: canPlanInvestigation(state),
        blockedReason:
          state.committedChoice === null
            ? canPlanInvestigation(state) ? null : readiness.blockedReason
            : '이 장면의 행동을 이미 결정했습니다. 결과를 확인한 뒤 다음으로 이동해 주세요.',
        deduction:
          definition.deduction && !isFirstInvestigation(state) &&
          definition.deduction.requires.every((id) => state.investigation.visited.includes(id))
            ? {
                prompt: definition.deduction.prompt,
                options: definition.deduction.options.map(({ id, label }) => ({ id, label })),
                requires: definition.deduction.requires,
                ...deductionDisplay,
              }
            : null,
        deductionSolved: state.investigation.deductionSolved,
        feedback: state.investigation.feedback,
        puzzle:
          definition.puzzle &&
          definition.required.every((id) => state.investigation.visited.includes(id))
            ? {
                kind: definition.puzzle.kind,
                title: definition.puzzle.title,
                instructions: definition.puzzle.instructions,
                pieces: definition.puzzle.pieces.map(({ id, label }) => ({ id, label })),
                ...(definition.puzzle.nodes ? { nodes: definition.puzzle.nodes } : {}),
                ...(definition.puzzle.edges ? { edges: definition.puzzle.edges } : {}),
              }
            : null,
      }
    : null;
  return freezeOwned({
    teamId: state.teamId,
    ...(state.playerName !== undefined ? { playerName: state.playerName } : {}),
    mode: state.mode,
    storyVersion: state.storyVersion,
    currentRoomId: state.currentRoomId,
    travel,
    canSkipIntro: canSkipIntro(state),
    sceneId: state.sceneId,
    revision: state.revision,
    phase: state.phase,
    title:
      state.storyVersion === STORY_VERSION &&
      state.sceneId === 'S01' &&
      !state.investigation.visited.includes('case')
        ? '제1 전시실'
        : state.content.title,
    nextScene: state.nextSceneId
      ? {
          id: state.nextSceneId,
          title:
            state.sceneId === 'O00'
              ? '제1 전시실'
              : contentFor(state.nextSceneId, state.flags, state.history).title,
          roomId: nextRoomId,
          roomLabel: nextRoom.label,
          reason:
            state.sceneId === 'O00' ? '윤서가 박물관의 첫 전시품을 소개하려고 합니다.' : null,
        }
      : null,
    chapter: state.content.chapter,
    messages: state.messages,
    ...(state.currentMessageId
      ? { currentMessage: state.messages.find((message) => message.id === state.currentMessageId) }
      : {}),
    choices: state.phase === 'choosing' && !definition?.puzzle ? state.content.choices : [],
    hints: state.content.hints.slice(0, state.hintPosition),
    hintCount: state.content.hints.length,
    topics: ['input', 'exploring'].includes(state.phase) ? topicsFor(state) : [],
    npc: travelling ? null : state.content.npc,
    flags: state.flags,
    knownFacts: state.knownFacts,
    observations: state.observations,
    exploration,
    history: state.history.map((entry) => ({
      sceneId: entry.sceneId,
      choiceId: entry.choiceId,
      nextSceneId: entry.nextSceneId,
      label:
        entry.label ??
        contentFor(entry.sceneId, entry.before, state.history).choices.find(
          (choice) => choice.id === entry.choiceId
        ).label,
    })),
    canNext:
      ['reading', 'result'].includes(state.phase) && state.position < state.segment.length,
    readingProgress: { read: state.position, total: state.segment.length },
    canContinue:
      (state.phase === 'result' && state.position === state.segment.length) ||
      (state.sceneId === 'O00' && state.phase === 'exploring' && readiness.canChoose),
    canHint:
      ALLOWED[state.phase].includes('HINT') && state.hintPosition < state.content.hints.length,
  });
}

function checksum(payload) {
  return sha256(JSON.stringify(payload));
}

/** Integrity is not authentication. Saves replay events and contain no trusted state snapshot. */
export function saveGame(state) {
  const payload = {
    version: SAVE_VERSION,
    storyVersion: state.storyVersion,
    teamId: state.teamId,
    events: state.events,
    ...(state.playerName !== undefined ? { playerName: state.playerName } : {}),
  };
  if (new TextEncoder().encode(JSON.stringify(payload)).length > LIMITS.saveBytes)
    return failure(
      'SAVE_LIMIT',
      '저장 기록이 2MB 한도를 넘었습니다. 현재 게임에서 진행을 이어가 주세요.'
    );
  return freezeOwned({ ok: true, record: { ...payload, checksum: checksum(payload) } });
}

/** Bounded replay performs no I/O. An unfinished legacy AI request is recorded as cancelled. */
export function restoreGame(record) {
  if (
    !hasOnly(record, ['version', 'storyVersion', 'teamId', 'events', 'checksum', 'playerName']) ||
    record.version !== SAVE_VERSION ||
    ![...Object.values(STORY_VERSIONS), PREVIOUS_MAP_VERSION].includes(record.storyVersion)
  ) {
    return failure(
      'VERSION_MISMATCH',
      '지원하지 않는 저장 버전입니다. 같은 이야기 버전에서 만든 기록을 사용해 주세요.'
    );
  }
  if (
    !Array.isArray(record.events) ||
    record.events.length > LIMITS.events ||
    typeof record.checksum !== 'string' ||
    !/^[a-f0-9]{64}$/.test(record.checksum)
  ) {
    return failure(
      'INVALID_SAVE',
      'events 개수 또는 checksum 형식이 잘못되었습니다. 내보낸 원래 저장 기록을 사용해 주세요.'
    );
  }
  const payload = {
    version: record.version,
    storyVersion: record.storyVersion,
    teamId: record.teamId,
    events: record.events,
    ...(record.playerName !== undefined ? { playerName: record.playerName } : {}),
  };
  let serialized;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    return failure(
      'INVALID_SAVE',
      '순환 참조가 있는 저장 기록입니다. JSON으로 내보낸 원래 기록을 사용해 주세요.'
    );
  }
  if (new TextEncoder().encode(serialized).length > LIMITS.saveBytes)
    return failure(
      'SAVE_LIMIT',
      '저장 기록은 2MB 이하여야 합니다. 원래 내보낸 기록을 사용해 주세요.'
    );
  if (checksum(payload) !== record.checksum)
    return failure(
      'CHECKSUM_MISMATCH',
      '저장 기록의 무결성 값이 다릅니다. 수정하지 않은 원래 기록을 사용해 주세요.'
    );
  const created = createGame(record.teamId, {
    ...(record.playerName !== undefined ? { playerName: record.playerName } : {}),
    mode:
      record.storyVersion === PREVIOUS_MAP_VERSION
        ? 'map'
        : Object.keys(STORY_VERSIONS).find(
            (mode) => STORY_VERSIONS[mode] === record.storyVersion
          ),
    storyVersion: record.storyVersion,
  });
  if (!created.ok) return created;
  let state = created.state;
  for (let index = 0; index < record.events.length; index += 1) {
    const result = transition(state, record.events[index]);
    if (!result.ok)
      return failure(
        'REPLAY_REJECTED',
        `events[${index}]를 재생할 수 없습니다 (${result.error.code}). 원래 저장 기록을 사용해 주세요.`
      );
    state = result.state;
  }
  if (state.pendingRequest) {
    const cancelled = transition(state, {
      type: 'CANCEL',
      teamId: state.teamId,
      sceneId: state.sceneId,
      revision: state.revision,
      requestId: state.pendingRequest.requestId,
    });
    if (!cancelled.ok) return cancelled;
    state = cancelled.state;
  }
  return freezeOwned({ ok: true, state, effects: [] });
}
