import { messages, readManuscript, section } from './read-manuscript.mjs';

const scenes = new Map();
for (const chapter of [1, 2]) {
  const manuscript = readManuscript(
    new URL(`../../docs/manuscript/chapter-${chapter}.md`, import.meta.url),
  );
  for (const [id, scene] of manuscript) scenes.set(id, { ...scene, chapter });
}

const acquisitions = {
  I01: { A: 'log', B: 'battery', C: 'map', D: 'request' },
  I02: { A: 'charter', B: 'request', C: 'battery', D: 'map' },
  I03: { A: 'map', B: 'battery', C: 'request', D: 'log' },
  I04: { A: 'charter', B: 'request', C: 'battery', D: 'map' },
  T21: { A: 'log', B: 'request', C: 'battery', D: 'map' },
  T22: { A: 'statement', B: 'request', C: 'battery', D: 'map' },
  D21: { A: 'charter', B: 'log', C: 'request', D: 'repair' },
  D22: { B: 'battery', C: 'charter', D: 'repair' },
  S22: { A: 'request', B: 'statement', D: 'battery' },
};

const itemNames = {
  charter: '옛 반환 규약',
  log: '실행 로그',
  request: '반환 요청서',
  statement: '서명 진술',
  battery: '공용 비상 배터리',
  map: '시설 도면',
  repair: '종이 보수 도구',
};

function conditional(raw, marker) {
  const headings = [...raw.matchAll(/^(?:\*\*)?조건: (.+)$/gm)];
  const matches = headings.filter((heading) => heading[1].includes(marker));
  if (matches.length !== 1)
    throw new Error(
      `Expected one manuscript condition "${marker}", found ${matches.length}; update the explicit mapping.`,
    );
  const match = matches[0];
  const index = headings.indexOf(match);
  return messages(
    raw.slice(match.index + match[0].length, headings[index + 1]?.index ?? raw.length),
  );
}

function replaceMessage(list, prefix, replacement) {
  const index = list.findIndex((message) => message.text.startsWith(prefix));
  if (index < 0)
    throw new Error(
      `Manuscript message "${prefix}" is missing; update its conditional replacement.`,
    );
  return [...list.slice(0, index), ...replacement, ...list.slice(index + 1)];
}

function insertAfter(list, prefix, addition) {
  const index = list.findIndex((message) => message.text.startsWith(prefix));
  if (index < 0)
    throw new Error(`Manuscript anchor "${prefix}" is missing; update its conditional insertion.`);
  return [...list.slice(0, index + 1), ...addition, ...list.slice(index + 1)];
}

function choiceSection(scene, choiceId) {
  const heading = [...scene.sections.keys()].find((key) => key.startsWith(`${choiceId} — `));
  if (!heading)
    throw new Error(`Choice "${choiceId}" is missing from ${scene.id}; choose A, B, C, or D.`);
  return { heading, raw: section(scene, heading) };
}

function withFacts(sceneId, list) {
  return list.map((message) => {
    if (sceneId === 'T22' && message.text.startsWith('돌려달라는 연락은 받은 적 없어요.')) {
      return { ...message, claimId: 'no_request' };
    }
    if (sceneId === 'I04' && message.text.startsWith('나래 씨가 연락했어요.')) {
      return { ...message, facts: ['request_received'] };
    }
    if (sceneId === 'T22' && message.text.startsWith('요청은 받았어요. 그건 아까')) {
      return { ...message, facts: ['request_received'] };
    }
    if (sceneId === 'T22' && message.text.startsWith('네. 그날이 지나면 설명할 수')) {
      return { ...message, facts: ['return_delayed'] };
    }
    if (
      message.speaker === '윤서' &&
      (message.text.startsWith('돌려달라고 하면 돌려주기로 했어요.') ||
        message.text.startsWith('그 반환 조항도 제가 손님용 안내에서 뺐어요.') ||
        message.text.startsWith('반환 조항을 뺀 일과 요청을 미룬 일은') ||
        message.text.startsWith('원래 반환 조항을 안내에서 빼고, 요청을 읽고도'))
    ) {
      return { ...message, facts: ['request_received', 'return_delayed', 'return_clause_removed'] };
    }
    if (sceneId === 'T22' && message.text.startsWith('나래 씨가 보낸 원문과 제가 확인한')) {
      return { ...message, facts: ['request_received'] };
    }
    return message;
  });
}

function choiceDetail(sceneId, choiceId, flags) {
  if (sceneId === 'S01')
    return '먼저 조사할 장소를 정합니다. 다른 장소의 자료가 함께 생기지는 않습니다.';
  if (sceneId === 'S12')
    return '다음에 누구의 설명을 어떻게 들을지 정합니다. 자료나 장비를 얻는 행동은 아닙니다.';
  if (sceneId === 'P11' || sceneId === 'P12') {
    return flags.map
      ? '현재 도면을 보유하고 있습니다. 힌트를 읽어도 벌점은 없으며, 같은 도면이 늘어나지는 않습니다.'
      : '한 답을 확정합니다. 힌트를 읽어도 벌점이 없고, 틀려도 안전한 통로로 이야기가 이어집니다.';
  }
  if (sceneId === 'P21')
    return '작업 순서만 검증합니다. 아직 함을 움직이거나 전원을 쓰지 않으며, 힌트에 벌점은 없습니다.';
  if ((sceneId === 'D22' && choiceId === 'A') || (sceneId === 'S22' && choiceId === 'C')) {
    if (flags.maintenance)
      return '배수선과 보조 레일은 이미 준비돼 있습니다. 다시 확인해도 장비가 늘어나지는 않습니다.';
    if (flags.map)
      return '도면을 보유하고 있어 배수선과 보조 레일 점검을 마칠 수 있습니다. 전원 사용은 이후 결정합니다.';
    return '도면이 없어 이번에는 위치를 확인하고 도면을 확보합니다. 정비 완료까지는 진행하지 못합니다.';
  }
  const item = acquisitions[sceneId]?.[choiceId];
  if (!item)
    throw new Error(
      `Choice detail is missing for ${sceneId}-${choiceId}; define its current cost and conditions.`,
    );
  if (flags[item])
    return `이미 ${itemNames[item]}을 보유하고 있습니다. 기존 자료·장비를 확인하며 추가 수량은 생기지 않습니다.`;
  if (item === 'battery')
    return '공용 비상 배터리 하나를 챙깁니다. 지금은 연결하지 않으며 실제 사용한 뒤에는 남지 않습니다.';
  if (item === 'map')
    return '시설 도면을 확보합니다. 위치 확인과 실제 배수선 정비는 별개의 작업입니다.';
  if (item === 'repair')
    return '구조 뒤 찢어진 배를 손볼 도구를 챙깁니다. 지금 수리하거나 번진 장부 글씨를 복원하지는 않습니다.';
  if (item === 'statement')
    return '원문과 변경 내용을 대조한 뒤 윤서의 서명 진술을 남깁니다. 다른 자료를 모두 얻는 것은 아닙니다.';
  return `${itemNames[item]}을 보존합니다. 이 행동만으로 다른 기록이나 구조 장비가 확보되지는 않습니다.`;
}

// Contract: authored player text only; facts become known when the engine reveals their message.
export function sceneContent(sceneId, flags, history) {
  const scene = scenes.get(sceneId);
  if (!scene) return null;
  let body = messages(section(scene, '본문'));
  const conditions = scene.sections.get('조건부 대사');

  if (sceneId === 'S12') {
    if (flags.lead) body.push(...conditional(conditions, `lead=${flags.lead}`));
    if (flags.log) body.push(...conditional(conditions, '`log`를 보유'));
    if (flags.request && flags.lead !== 'curator')
      body.push(...conditional(conditions, '`request`를 보유'));
  }
  if (sceneId === 'T21') {
    if (flags.stance === 'listen') body = [...conditional(conditions, 'S12-A'), ...body];
    if (flags.stance === 'verify') {
      body = replaceMessage(body, '처음부터 차례대로 설명해 줘.', conditional(conditions, 'S12-B'));
    }
  }
  if (sceneId === 'T22') {
    if (flags.stance === 'confront') {
      body = insertAfter(body, '윤서가 모로에게서 한 걸음', conditional(conditions, 'S12-D'));
    }
    const received = flags.lead === 'curator' || history.some((entry) => entry.sceneId === 'I04');
    body = insertAfter(
      body,
      '누가 옮겼는지는 들었어요.',
      conditional(
        conditions,
        received ? 'I04를 거쳤거나' : '윤서에게 요청 수신을 아직 인정받지 않음',
      ),
    );
  }
  if (sceneId === 'D21' && flags.statement) {
    body = replaceMessage(
      body,
      '제 서명 진술이 없다면',
      conditional(conditions, '`statement`를 이미'),
    );
  }
  if (sceneId === 'D22')
    body.push(...conditional(conditions, flags.map ? '`map=true`' : '`map=false`'));
  if (sceneId === 'S22') {
    if (flags.statement)
      body = replaceMessage(body, '그 반환 조항도', conditional(conditions, '윤서가 이미 규약'));
    if (flags.maintenance && flags.battery)
      body.push(...conditional(conditions, '`maintenance=true`이고 `battery=true`'));
    body.push(
      ...conditional(
        conditions,
        flags.maintenance ? '`maintenance=true`.' : flags.map ? '`map=true`이고' : '`map=false`',
      ),
    );
  }

  const hints = scene.sections.has('힌트')
    ? [...section(scene, '힌트').matchAll(/^\*\*힌트 \d+:\*\* (.+)$/gm)].map((match) => match[1])
    : [];
  return {
    id: sceneId,
    title: scene.title,
    chapter: scene.chapter,
    messages: withFacts(sceneId, body),
    choices: ['A', 'B', 'C', 'D'].map((id) => ({
      id,
      label: choiceSection(scene, id).heading.slice(4),
      detail: choiceDetail(sceneId, id, flags),
    })),
    hints,
    npc: sceneId === 'T21' ? 'moro' : sceneId === 'T22' ? 'yunseo' : null,
  };
}

// Only text varies here. State/resource changes belong exclusively to the game engine.
export function resultContent(sceneId, choiceId, before, after, history) {
  const scene = scenes.get(sceneId);
  if (!scene) return null;
  const { raw } = choiceSection(scene, choiceId);
  const conditions = scene.sections.get('조건부 대사');
  let result = messages(raw);

  if (sceneId === 'P12' && choiceId === 'B' && before.map) {
    result = [result[0], ...messages(conditions)];
  }
  if (sceneId === 'T21') {
    const item = acquisitions.T21[choiceId];
    if (before[item]) {
      const replacement = conditional(conditions, `\`${item}\``);
      const prefix = {
        A: '규약 번호, 이송 시각',
        B: '전날 접수된 요청입니다.',
        C: '모로가 공용 비상 보관함을 연다.',
        D: '수동 배수선과 외부 밸브가 표시된 도면을 챙긴다.',
      }[choiceId];
      result = replaceMessage(result, prefix, replacement);
    }
  }
  if (sceneId === 'T22') {
    if (choiceId === 'B' && before.request) {
      result = replaceMessage(result, '요청서가 기록장에 들어간다.', [
        {
          speaker: '서술',
          text: '이미 가진 요청서의 원문과 수신 확인을 다시 대조한다. 같은 문서임을 확인한 뒤 윤서가 가리킨 기록 조사 단말로 향한다.',
        },
      ]);
    }
    if (choiceId === 'C' && before.battery) {
      result = replaceMessage(result, '배터리를 챙겨 시설 조사로 향한다.', [
        {
          speaker: '서술',
          text: '이미 가진 배터리의 연결구와 사용 조건을 확인하고 시설 조사로 향한다. 들은 이야기는 기록에 남지만, 서명 진술을 받은 것은 아니다.',
        },
      ]);
    }
    if (choiceId === 'D' && before.map) {
      result = replaceMessage(result, '도면을 챙긴 여러분은', [
        {
          speaker: '서술',
          text: '이미 가진 도면의 표시를 윤서와 대조한다. 같은 도면을 접어 넣고 배수선 쪽으로 향한다. 실제 정비는 그곳에서 해야 한다.',
        },
      ]);
    }
  }
  if (
    sceneId === 'D21' &&
    ['A', 'B', 'C'].includes(choiceId) &&
    before[acquisitions.D21[choiceId]]
  ) {
    const prefix = {
      A: '출력구에서 얇은 종이가 나온다.',
      B: '기록을 보존했습니다.',
      C: '나래가 남긴 요청 문장과 윤서의 수신 확인을 함께 저장한다.',
    }[choiceId];
    result = replaceMessage(result, prefix, conditional(conditions, '선택한 자료'));
  }
  if (sceneId === 'D22') {
    if (choiceId === 'A') result = conditional(raw, before.map ? '`map=true`' : '`map=false`');
    if (choiceId === 'B' && before.battery) {
      result = replaceMessage(
        result,
        '윤서가 비상함의 봉인을 풀고',
        conditional(conditions, '`battery=true`'),
      );
    }
    if (['C', 'D'].includes(choiceId) && before[acquisitions.D22[choiceId]]) {
      const prefix =
        choiceId === 'C'
          ? '안내판에서 문서 번호가 읽히는'
          : '종이용 보수 테이프와 작은 도구를 묶어';
      result = replaceMessage(result, prefix, conditional(conditions, '`charter` 또는 `repair`'));
    }
  }
  if (sceneId === 'S22') {
    if (choiceId === 'C') {
      result = conditional(
        raw,
        before.maintenance ? '`maintenance=true`' : before.map ? '`map=true`' : '`map=false`',
      );
    }
    if (choiceId === 'A' && before.request) {
      result = replaceMessage(result, '반환 요청 원문과 수신 확인을 보존한다.', [
        {
          speaker: '서술',
          text: '이미 보존한 반환 요청 원문과 수신 확인을 단말의 자료와 대조한다. 나래의 뜻을 들은 사실과 기관의 처리를 입증할 자료를 구분해 기록한다.',
        },
      ]);
    }
    if (choiceId === 'B' && before.statement) {
      result = replaceMessage(result, '윤서가 문서의 내용을 읽고 서명한다.', [
        {
          speaker: '서술',
          text: '윤서가 앞서 서명한 진술을 다시 읽는다. 규약 변경과 요청 지연이 명시된 기존 진술과 방금 설명이 일치함을 확인한다.',
        },
      ]);
    }
    if (choiceId === 'D' && before.battery) {
      result = replaceMessage(result, '단 하나 남아 있던 공용 비상 배터리를 확보한다.', [
        {
          speaker: '서술',
          text: '공용 비상 배터리는 이미 여러분이 가지고 있다. 연결하지 않은 단자와 남은 전원을 확인한다. 구조 장치에 쓸지 모로를 깨울 때 남길지는 아직 정하지 않는다.',
        },
      ]);
    }
  }
  return withFacts(sceneId, result);
}
