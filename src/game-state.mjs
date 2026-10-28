import { STORY_VERSION, opening, topicFor, choiceFor, responseFor } from './t22-dialogue.mjs';

const RULES_VERSION = 't22-rules-1';
export const LIMITS = Object.freeze({ inputCodePoints: 600, aiTurns: 3, messagesPerReply: 8, messages: 256, events: 512 });
const EVIDENCE = ['request', 'charter', 'log', 'statement'];
const RESOURCES = ['battery', 'map', 'maintenance', 'repair'];
const FACTS = ['request_received', 'return_delayed', 'return_clause_removed'];
const ENVELOPE = ['type', 'teamId', 'sceneId', 'sceneRevision'];
const EVENT_FIELDS = {
  NEXT_MESSAGE: [], SELECT_TOPIC: ['topicId'],
  SUBMIT_TEXT: ['requestId', 'text', 'evidenceId'],
  RESOLVE_TURN: ['requestId', 'interpretation'], FAIL_TURN: ['requestId', 'reason'],
  CANCEL_TURN: ['requestId'], OPEN_CHOICES: [], BACK_TO_DIALOGUE: [],
  CONFIRM_CHOICE: ['choiceId'], CONTINUE: [],
};
const ALLOWED = {
  reading: ['NEXT_MESSAGE', 'OPEN_CHOICES'],
  input: ['SELECT_TOPIC', 'SUBMIT_TEXT', 'OPEN_CHOICES'],
  evaluating: ['RESOLVE_TURN', 'FAIL_TURN', 'CANCEL_TURN', 'OPEN_CHOICES'],
  choosing: ['BACK_TO_DIALOGUE', 'CONFIRM_CHOICE'],
  result: ['NEXT_MESSAGE', 'CONTINUE'],
};

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOnly = (value, fields) => isRecord(value) && Object.keys(value).length <= fields.length && Object.keys(value).every(key => fields.includes(key));
const isId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
const union = (current, added) => [...new Set([...current, ...added])].sort();
const failure = (code, message) => ({ ok: false, error: { code, message } });

function freezeOwned(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) freezeOwned(item);
  return Object.freeze(value);
}

function validSet(value, allowed) {
  return Array.isArray(value) && value.length <= allowed.length && value.every(item => allowed.includes(item)) && new Set(value).size === value.length;
}

function reveal(state, template) {
  const knownFacts = union(state.knownFacts, template.facts || []);
  let activeClaimId = Object.hasOwn(template, 'claimId') ? template.claimId : state.activeClaimId;
  if (knownFacts.includes('request_received')) activeClaimId = null;
  const message = { id: `T22-${state.messages.length + 1}`, speaker: template.speaker, text: template.text, facts: [...(template.facts || [])] };
  return { ...state, knownFacts, activeClaimId, messages: [...state.messages, message] };
}

function startSegment(state, segment, phase = 'reading') {
  const next = { ...state, phase, segment, readingPosition: 1 };
  return reveal(next, segment[0]);
}

function finishRequest(state, status) {
  return {
    ...state,
    requests: state.requests.map(request => request.requestId === state.pendingRequest.requestId ? { ...request, status } : request),
    pendingRequest: null,
  };
}

function commit(previous, state, event, ruleId, effects = []) {
  const sequence = previous.journal.length + 1;
  const entry = {
    sequence, event: structuredClone(event), ruleId,
    messages: state.messages.slice(previous.messages.length),
    factsAdded: state.knownFacts.filter(fact => !previous.knownFacts.includes(fact)),
    evidenceAdded: state.evidence.filter(item => !previous.evidence.includes(item)),
    resourcesAdded: state.resources.filter(item => !previous.resources.includes(item)),
  };
  return freezeOwned({ ok: true, state: { ...state, journal: [...previous.journal, entry] }, effects });
}

/**
 * Create the T22 slice from a trusted scene-entry snapshot. Sets are copied and
 * returned state is deeply frozen. Invalid boundary data returns a tagged failure.
 * No time, randomness, storage, network, or other sessions are read.
 * Contract: ../docs/narrative/game-state-design.md
 */
export function createT22(input) {
  if (!hasOnly(input, ['teamId', 'entryRoute', 'evidence', 'resources', 'knownFacts', 'stance']) || ![1, 2, 3].includes(input.teamId)) {
    return failure('INVALID_ENTRY', 'teamId는 1, 2, 3 중 하나인 T22 진입 자료를 사용해 주세요.');
  }
  const knownFacts = input.knownFacts ?? [];
  const stance = input.stance ?? 'ask';
  if (!['I01', 'I02', 'I03', 'I04'].includes(input.entryRoute) || !['ask', 'confront'].includes(stance)) {
    return failure('INVALID_ENTRY', 'entryRoute는 I01~I04, stance는 ask 또는 confront로 지정해 주세요.');
  }
  if (!validSet(input.evidence, EVIDENCE) || !validSet(input.resources, RESOURCES) || !validSet(knownFacts, FACTS)) {
    return failure('INVALID_ENTRY', 'evidence, resources, knownFacts에는 지원하는 ID를 중복 없이 배열로 지정해 주세요.');
  }
  const facts = union(knownFacts, input.entryRoute === 'I04' ? ['request_received'] : []);
  if (facts.includes('return_delayed') && !facts.includes('request_received')) {
    return failure('INVALID_ENTRY', 'return_delayed를 아는 진입 자료에는 request_received도 포함해야 합니다.');
  }
  const entry = { teamId: input.teamId, entryRoute: input.entryRoute, evidence: [...input.evidence].sort(), resources: [...input.resources].sort(), knownFacts: facts, stance };
  const state = {
    storyVersion: STORY_VERSION, rulesVersion: RULES_VERSION, entry,
    teamId: entry.teamId, sceneId: 'T22', sceneRevision: 1,
    phase: 'reading', evidence: [...entry.evidence], resources: [...entry.resources], knownFacts: facts,
    activeClaimId: null, messages: [], segment: [], readingPosition: 0,
    pendingRequest: null, requests: [], committedChoice: null, nextSceneId: null, journal: [],
  };
  return freezeOwned({ ok: true, state: startSegment(state, opening(facts, stance)), effects: [] });
}

function validInterpretation(value) {
  if (!isRecord(value)) return false;
  if (value.kind === 'unclear') return hasOnly(value, ['kind']);
  if (value.kind === 'action') return hasOnly(value, ['kind', 'choiceId']) && ['A', 'B', 'C', 'D'].includes(value.choiceId);
  if (value.kind === 'topic') return hasOnly(value, ['kind', 'topicId']) && isId(value.topicId) && topicFor(value.topicId, []) !== null;
  return value.kind === 'challenge' && hasOnly(value, ['kind', 'claimId', 'verdict']) && value.claimId === 'no_request' && ['supported', 'unsupported', 'unclear'].includes(value.verdict);
}

/**
 * Apply an event to state returned by createT22/transition, without mutating it.
 * Events are untrusted boundary data. RESOLVE_TURN/FAIL_TURN are adapter-only;
 * a web client must never be authorized to dispatch them directly. Duplicate
 * submissions are no-ops; stale responses return a failure without effects.
 * Effects describe I/O for a caller to execute once; this function performs none.
 */
export function transition(state, event) {
  if (!isRecord(event) || typeof event.type !== 'string' || !Object.hasOwn(EVENT_FIELDS, event.type) || !hasOnly(event, [...ENVELOPE, ...EVENT_FIELDS[event.type]])) {
    return failure('INVALID_EVENT', 'event.type과 필드를 확인해 주세요. 현재 장면의 지원하는 사건만 보낼 수 있습니다.');
  }
  if (event.teamId !== state.teamId) return failure('TEAM_MISMATCH', '이 사건의 teamId가 현재 팀과 다릅니다. 현재 팀의 요청을 사용해 주세요.');
  if (event.sceneId !== state.sceneId || event.sceneRevision !== state.sceneRevision) {
    return failure('STALE_RESPONSE', '장면이나 버전이 바뀌었습니다. 현재 장면에서 다시 행동해 주세요.');
  }
  if (state.phase === 'handoff') return failure('SCENE_HANDOFF', 'T22가 끝났습니다. 반환된 ENTER_SCENE으로 다음 장면을 시작해 주세요.');

  let normalized = event;
  if (event.type === 'SUBMIT_TEXT') {
    if (!isId(event.requestId) || typeof event.text !== 'string' || event.text.length > LIMITS.inputCodePoints * 2) {
      return failure('INVALID_INPUT', 'requestId는 영문·숫자·밑줄·하이픈 1~64자, text는 1~600자로 입력해 주세요.');
    }
    const text = event.text.trim();
    if (!text || Array.from(text).length > LIMITS.inputCodePoints || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
      return failure('INVALID_INPUT', 'text는 공백을 제외한 1~600자이며 제어문자를 포함할 수 없습니다. 질문을 줄이거나 다시 입력해 주세요.');
    }
    if (event.evidenceId !== null && !EVIDENCE.includes(event.evidenceId)) {
      return failure('INVALID_INPUT', 'evidenceId는 기록장의 자료 ID 하나 또는 null로 지정해 주세요.');
    }
    normalized = { ...event, text };
    const previous = state.requests.find(request => request.requestId === event.requestId);
    if (previous) {
      if (previous.text !== text || previous.evidenceId !== event.evidenceId) return failure('REQUEST_ID_CONFLICT', '같은 requestId에 다른 질문을 보낼 수 없습니다. 새 질문에는 새 ID를 사용해 주세요.');
      return { ok: true, state, effects: [] };
    }
  }
  if (['RESOLVE_TURN', 'FAIL_TURN', 'CANCEL_TURN'].includes(event.type)) {
    if (!isId(event.requestId) || state.pendingRequest?.requestId !== event.requestId) {
      return failure('STALE_RESPONSE', '이 requestId는 대기 중인 요청이 아닙니다. 취소되거나 처리된 응답을 다시 적용할 수 없습니다.');
    }
  }
  if (!ALLOWED[state.phase]?.includes(event.type)) {
    return failure('EVENT_NOT_ALLOWED', `${state.phase} 상태에서는 ${event.type}을 처리할 수 없습니다. 가능한 행동: ${(ALLOWED[state.phase] || []).join(', ')}.`);
  }
  // Keep enough room for the pending reply, one choice, its result, and handoff.
  const closingReserve = LIMITS.messagesPerReply * 2 + 4;
  if (state.journal.length >= LIMITS.events - closingReserve && ['SELECT_TOPIC', 'SUBMIT_TEXT', 'BACK_TO_DIALOGUE'].includes(event.type)) {
    return failure('DIALOGUE_LIMIT', '이 장면의 추가 대화 한도에 도달했습니다. A–D 행동을 선택해 계속해 주세요.');
  }

  if (event.type === 'NEXT_MESSAGE') {
    if (state.readingPosition >= state.segment.length) {
      if (state.phase === 'result') return failure('RESULT_READ', '결과를 모두 읽었습니다. CONTINUE로 다음 장면에 이동해 주세요.');
      return commit(state, { ...state, phase: 'input' }, normalized, 'reading.complete');
    }
    const next = reveal(state, state.segment[state.readingPosition]);
    return commit(state, { ...next, readingPosition: state.readingPosition + 1 }, normalized, 'reading.next');
  }

  if (event.type === 'SELECT_TOPIC') {
    if (!isId(event.topicId)) return failure('INVALID_TOPIC', 'topicId는 현재 장면에 있는 질문 ID로 지정해 주세요.');
    const topic = topicFor(event.topicId, state.knownFacts, state.activeClaimId);
    if (!topic) return failure('INVALID_TOPIC', '해당 topicId가 없습니다. 현재 장면의 질문 목록에서 골라 주세요.');
    if (topic.requiresFact && !state.knownFacts.includes(topic.requiresFact)) return failure('TOPIC_LOCKED', `이 질문에는 ${topic.requiresFact} 확인이 먼저 필요합니다. 지금 공개된 사실부터 질문해 주세요.`);
    if (topic.evidenceId && !state.evidence.includes(topic.evidenceId)) return failure('EVIDENCE_NOT_OWNED', `${topic.evidenceId} 자료를 보존하지 않았습니다. 가진 자료를 고르거나 A의 기록 대조로 진행해 주세요.`);
    if (state.messages.length + topic.replies.length + 1 > LIMITS.messages - LIMITS.messagesPerReply) return failure('DIALOGUE_LIMIT', '추가 대화 분량 한도에 도달했습니다. A–D 행동을 선택해 계속해 주세요.');
    const segment = [{ speaker: '팀', text: topic.question }, ...topic.replies];
    return commit(state, startSegment(state, segment), normalized, `topic.${event.topicId}`);
  }

  if (event.type === 'SUBMIT_TEXT') {
    if (event.evidenceId && !state.evidence.includes(event.evidenceId)) return failure('EVIDENCE_NOT_OWNED', `${event.evidenceId} 자료를 보존하지 않았습니다. 현재 기록장에서 자료를 선택해 주세요.`);
    if (state.requests.length >= LIMITS.aiTurns) return failure('TURN_LIMIT', '이 장면의 AI 질문 한도에 도달했습니다. 준비된 질문이나 A–D 행동으로 계속해 주세요.');
    if (state.messages.length + LIMITS.messagesPerReply * 2 > LIMITS.messages) return failure('DIALOGUE_LIMIT', '추가 대화 분량 한도에 도달했습니다. A–D 행동으로 계속해 주세요.');
    const request = { requestId: event.requestId, text: normalized.text, evidenceId: event.evidenceId, claimId: state.activeClaimId, status: 'pending' };
    const next = reveal({ ...state, phase: 'evaluating', pendingRequest: request, requests: [...state.requests, request] }, { speaker: '팀', text: normalized.text });
    const effect = { type: 'INTERPRET_TURN', teamId: state.teamId, sceneId: state.sceneId, sceneRevision: state.sceneRevision, requestId: request.requestId, text: request.text, evidenceId: request.evidenceId, claimId: request.claimId, knownFacts: [...state.knownFacts] };
    return commit(state, next, normalized, 'question.submitted', [effect]);
  }

  if (event.type === 'RESOLVE_TURN') {
    const candidate = event.interpretation;
    const pending = state.pendingRequest;
    let replies;
    let ruleId;
    let status = 'resolved';
    if (!validInterpretation(candidate)) {
      // Keep malformed/cyclic model data out of the bounded replay journal.
      normalized = { ...event, type: 'FAIL_TURN', reason: 'invalid_output' };
      delete normalized.interpretation;
      replies = responseFor('failure');
      ruleId = 'question.invalid_output';
      status = 'failed';
    } else if (candidate.kind === 'action') {
      replies = responseFor('action', candidate.choiceId);
      ruleId = 'question.action_proposed';
    } else if (candidate.kind === 'topic') {
      const topic = topicFor(candidate.topicId, state.knownFacts, state.activeClaimId);
      const factAllowed = !topic.requiresFact || state.knownFacts.includes(topic.requiresFact);
      const evidenceAllowed = !topic.evidenceId || (pending.evidenceId === topic.evidenceId && state.evidence.includes(topic.evidenceId));
      replies = factAllowed && evidenceAllowed ? topic.replies : responseFor('unclear');
      ruleId = factAllowed && evidenceAllowed ? `question.topic.${candidate.topicId}` : 'question.topic_unavailable';
    } else if (candidate.kind === 'challenge') {
      if (state.knownFacts.includes('request_received')) {
        replies = topicFor('return_request', state.knownFacts).replies;
        ruleId = 'question.already_admitted';
      } else if (candidate.verdict === 'supported' && pending.claimId === candidate.claimId && state.activeClaimId === candidate.claimId && pending.evidenceId === 'request' && state.evidence.includes('request')) {
        replies = topicFor('receipt', []).replies;
        ruleId = 'question.receipt_contradiction';
      } else {
        replies = responseFor(candidate.verdict === 'unclear' ? 'unclear' : 'unsupported');
        ruleId = 'question.unproven';
      }
    } else {
      replies = responseFor('unclear');
      ruleId = 'question.unclear';
    }
    return commit(state, startSegment(finishRequest(state, status), replies), normalized, ruleId);
  }

  if (event.type === 'FAIL_TURN') {
    if (!['timeout', 'refusal', 'invalid_output', 'quota', 'network'].includes(event.reason)) return failure('INVALID_FAILURE', 'reason은 timeout, refusal, invalid_output, quota, network 중 하나로 지정해 주세요.');
    return commit(state, startSegment(finishRequest(state, 'failed'), responseFor('failure')), normalized, `question.${event.reason}`);
  }

  if (event.type === 'CANCEL_TURN' || event.type === 'OPEN_CHOICES') {
    const effects = state.pendingRequest ? [{ type: 'CANCEL_REQUEST', requestId: state.pendingRequest.requestId, teamId: state.teamId }] : [];
    const next = state.pendingRequest ? finishRequest(state, 'cancelled') : state;
    return commit(state, { ...next, phase: event.type === 'OPEN_CHOICES' ? 'choosing' : 'input' }, normalized, event.type === 'OPEN_CHOICES' ? 'choices.open' : 'question.cancelled', effects);
  }

  if (event.type === 'BACK_TO_DIALOGUE') {
    // Resuming a partially read segment must not silently reveal its future facts.
    const phase = state.readingPosition < state.segment.length ? 'reading' : 'input';
    return commit(state, { ...state, phase }, normalized, 'choices.back');
  }

  if (event.type === 'CONFIRM_CHOICE') {
    if (!['A', 'B', 'C', 'D'].includes(event.choiceId)) return failure('INVALID_CHOICE', 'choiceId는 현재 장면의 A, B, C, D 중 하나로 지정해 주세요.');
    const choice = choiceFor(event.choiceId, state.evidence, state.resources);
    const next = {
      ...state, evidence: union(state.evidence, choice.evidence ? [choice.evidence] : []),
      resources: union(state.resources, choice.resource ? [choice.resource] : []),
      knownFacts: union(state.knownFacts, choice.facts),
      committedChoice: event.choiceId, nextSceneId: choice.nextSceneId,
    };
    return commit(state, startSegment(next, choice.replies, 'result'), normalized, `choice.${event.choiceId}`);
  }

  if (event.type === 'CONTINUE') {
    if (state.readingPosition < state.segment.length) return failure('RESULT_UNREAD', '아직 읽지 않은 결과가 있습니다. NEXT_MESSAGE로 결과를 확인한 뒤 이동해 주세요.');
    const next = { ...state, phase: 'handoff', sceneId: state.nextSceneId, sceneRevision: state.sceneRevision + 1, segment: [], readingPosition: 0, activeClaimId: null };
    return commit(state, next, normalized, 'scene.handoff', [{ type: 'ENTER_SCENE', teamId: state.teamId, sceneId: next.sceneId, sceneRevision: next.sceneRevision }]);
  }
  throw new Error('A supported event has no transition; update the state-machine contract and dispatch together.');
}

/** Replay a bounded, version-matched event record atomically; never execute effects. */
export function replayT22(record) {
  if (!hasOnly(record, ['storyVersion', 'rulesVersion', 'entry', 'events']) || record.storyVersion !== STORY_VERSION || record.rulesVersion !== RULES_VERSION) {
    return failure('VERSION_MISMATCH', '이 기록의 storyVersion 또는 rulesVersion을 지원하지 않습니다. 같은 버전의 기록을 사용해 주세요.');
  }
  if (!Array.isArray(record.events) || record.events.length > LIMITS.events) return failure('REPLAY_LIMIT', `events는 ${LIMITS.events}개 이하의 사건 배열이어야 합니다.`);
  const created = createT22(record.entry);
  if (!created.ok) return created;
  let state = created.state;
  for (let index = 0; index < record.events.length; index += 1) {
    const result = transition(state, record.events[index]);
    if (!result.ok) return failure('REPLAY_EVENT_REJECTED', `events[${index}]를 적용할 수 없습니다 (${result.error.code}). 원래 기록을 사용해 주세요.`);
    state = result.state;
  }
  return { ok: true, state, effects: [] };
}
