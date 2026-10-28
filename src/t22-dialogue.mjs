export const STORY_VERSION = 'museum-t22-1';

const curator = (text, details = {}) => ({ speaker: '윤서', text, ...details });

const topics = {
  interruption: {
    question: '그래서 모로의 설명을 막으신 건가요?',
    replies: [curator('배를 옮겼다는 말만 들으면, 다들 모로가 훔쳤다고 생각할 테니까요.')],
  },
  finish_explanation: {
    question: '끝까지 설명하게 두면 됐잖아요.',
    replies: [curator('그 애는 자기가 한 일을 순서대로 말해요. 그게 사람들에게 어떻게 들릴지는 생각하지 않고요.')],
  },
  movement_order: {
    question: '관장님이 알고 있는 순서부터 듣죠. 배는 왜 진열장에 없나요?',
    replies: [curator('제가 옮기라고 한 건 아니에요.')],
  },
  return_request: {
    question: '관장님 말고 누군가 요청했을 수도 있겠네요.',
    replies: [curator('돌려달라는 연락은 받은 적 없어요. 모로가 혼자 움직인 거예요.', { claimId: 'no_request' })],
  },
  receipt: {
    question: '요청서에 관장님 수신 확인이 있는데요. 못 받았다는 말과 다르잖아요.',
    evidenceId: 'request',
    replies: [
      curator('……제 확인이 맞아요.', { facts: ['request_received'] }),
      curator('받았어요. 내일 배를 띄우고 싶다고 적혀 있었죠. 읽고도 처리를 미뤘습니다.', { facts: ['return_delayed'] }),
    ],
  },
  reply_to_nara: {
    question: '나래 씨한테 기다려 달라고 하셨나요?',
    requiresFact: 'request_received',
    replies: [curator('아니요. 말하지 않았어요.'), curator('저는 마지막 전시가 끝난 다음에 생각하려고 했어요.', { facts: ['return_delayed'] })],
  },
  deadline: {
    question: '아침 아홉 시에 필요하다고 적혀 있는데도요?',
    requiresFact: 'return_delayed',
    replies: [curator('그 문장을 안 읽은 게 아니에요. 읽고도, 오늘까지는 여기 있어 줬으면 했어요.')],
  },
  first_exhibit: {
    question: '배 한 척이 그렇게 중요했나요?',
    requiresFact: 'return_delayed',
    replies: [curator('첫 전시품이니까요.'), curator('여기가 아직 박물관 같아 보이려면, 적어도 저 자리는 채워져 있어야 한다고 생각했어요.')],
  },
  empty_case: {
    question: '돌려준 자리라고 설명할 수도 있잖아요.',
    requiresFact: 'return_delayed',
    replies: [curator('손님들에게는 그렇게 말할 수 있었겠죠. 제가 그 빈자리를 보고 싶지 않았던 거예요.')],
  },
  explanation: {
    question: '그래서 모로가 옮겼다는 말도 끝까지 듣기 싫었던 건가요?',
    requiresFact: 'return_delayed',
    replies: [curator('그 말을 끝까지 들으면, 제가 미뤄 둔 일부터 설명해야 하니까요.')],
  },
  records: {
    question: '우리가 아직 확인해야 할 게 뭔가요?',
    replies: [curator('요청을 받은 기록, 원래 어떻게 돌려주기로 했는지 적힌 조항, 지금 손님들에게 보여 주는 안내요. 같이 봐야 해요.')],
  },
  key: {
    question: '열쇠가 닳았으니 어제도 반환실에 갔던 거죠?',
    replies: [curator('오래 쓴 열쇠예요. 닳았다는 것만으로 어제 사용했다고 할 수는 없잖아요.')],
  },
  key_ownership: {
    question: '그럼 열쇠를 가지고 있는 이유는요?',
    replies: [curator('제가 관리하는 방의 열쇠니까요. 그걸 갖고 있다는 것과 배를 옮겼다는 건 다른 얘기예요.')],
  },
};

const choices = {
  A: {
    title: '인정한 사실을 서명으로 남기게 한다.',
    evidence: 'statement',
    nextSceneId: 'D21',
    facts: ['request_received', 'return_delayed', 'return_clause_removed'],
    replies: [
      { speaker: '서술', text: '요청 원문과 옛 반환 조항, 변경된 안내를 함께 대조한다. 윤서가 규약 변경과 요청 지연을 명시한 진술에 서명한다.' },
      curator('돌려달라고 하면 돌려주기로 했어요. 그 문장을 제가 안내에서 뺐습니다. 이건 제 이름으로 남길게요.'),
      { speaker: '팀', text: '요청을 읽고도 미뤘다는 내용도 넣어 주세요.' },
      curator('네. 제가 확인했고, 처리하지 않았습니다.'),
      { speaker: '팀', text: '이제 이 기록과 실제 규약을 대조해 보죠.' },
    ],
  },
  B: {
    title: '기증자의 요청 원문과 수신 확인을 보존하게 한다.',
    evidence: 'request',
    nextSceneId: 'D21',
    facts: ['request_received'],
    replies: [
      curator('나래 씨가 보낸 원문과 제가 확인한 기록이에요. 함께 보관해 주세요.'),
      { speaker: '팀', text: '이 기록부터 그대로 남겨 둘게요.' },
      curator('기록 조사 화면을 열어 드릴게요.'),
    ],
  },
  C: {
    title: '말보다 비상 전원을 먼저 내놓게 한다.',
    resource: 'battery',
    nextSceneId: 'D22',
    facts: [],
    replies: [
      curator('비상 배터리는 이 하나예요. 한 번 쓰면 다른 곳에 다시 쓸 수 없어요.'),
      { speaker: '팀', text: '어디에 쓸지는 상태를 보고 정하겠습니다.' },
      curator('배수선 쪽부터 확인해 주세요. 거기도 점검을 미뤘어요.'),
      { speaker: '팀', text: '배를 구한 다음에는, 미뤘던 이야기로 돌아오죠.' },
    ],
  },
  D: {
    title: '미뤄 둔 시설 점검의 도면을 내놓게 한다.',
    resource: 'map',
    nextSceneId: 'D22',
    facts: [],
    replies: [
      curator('이 선을 따라가면 밖에서 조작할 수 있는 밸브가 있어요.'),
      { speaker: '팀', text: '지금도 작동하나요?' },
      curator('확인하지 못했어요. 도면만 보고 된다고 말씀드릴 수는 없어요.'),
      { speaker: '팀', text: '그럼 가서 확인하죠.' },
    ],
  },
};

// The engine owns returned copies; content is never changed by a play session.
export function opening(knownFacts, stance) {
  if (knownFacts.includes('request_received')) {
    return [curator('요청은 받았어요. 하지만 마지막 전시까지는 남아 있어야 한다고 생각했어요.')];
  }
  if (stance === 'confront') {
    return [curator('반환실을 관리하는 열쇠예요. 닳았다는 것만으로 최근에 썼다고 말씀드릴 수는 없어요.')];
  }
  return [curator('마지막 전시예요. 이곳에 무엇이 남아 있었는지, 한 번은 더 보여 주고 싶었어요.')];
}

export function topicFor(topicId, knownFacts, activeClaimId = null) {
  if (!Object.hasOwn(topics, topicId)) return null;
  const topic = structuredClone(topics[topicId]);
  if (topicId === 'receipt' && activeClaimId !== 'no_request') {
    topic.question = '이 요청서의 수신 확인은 관장님이 하신 건가요?';
  }
  if (['return_request', 'receipt'].includes(topicId) && knownFacts.includes('request_received')) {
    topic.question = '받은 요청을 왜 처리하지 않았나요?';
    topic.replies = [curator('요청을 받은 건 맞아요. 마지막 전시가 끝난 다음에 생각하려고 미뤘습니다.', { facts: ['return_delayed'] })];
  }
  return topic;
}

export function choiceFor(choiceId, evidence, resources) {
  if (!Object.hasOwn(choices, choiceId)) return null;
  const choice = structuredClone(choices[choiceId]);
  const alreadyOwned = evidence.includes(choice.evidence) || resources.includes(choice.resource);
  if (alreadyOwned) {
    choice.replies.unshift({ speaker: '서술', text: `${choiceId === 'B' ? '이미 보존한 자료를 원문과 대조한다' : '이미 확보한 물건과 사용 조건을 다시 확인한다'}. 같은 물건을 추가로 얻지는 않는다.` });
  }
  return choice;
}

export function responseFor(kind, choiceId = null) {
  if (kind === 'action') return [{ speaker: '게임', text: `${choiceId} 행동을 원하면 행동 선택에서 팀의 결정을 확정해 주세요.` }];
  if (kind === 'failure') return [{ speaker: '게임', text: '대화 연결을 이어갈 수 없습니다. 준비된 질문이나 A–D 행동으로 계속할 수 있습니다.' }];
  if (kind === 'unsupported') return [curator('지금 말씀하신 내용만으로는 그 점을 확인하기 어려워요. 어떤 기록과 제 말을 비교하시는 건가요?')];
  return [curator('어느 말이 어떤 기록과 다르다고 생각하시는지, 조금 더 알려 주시겠어요?')];
}
