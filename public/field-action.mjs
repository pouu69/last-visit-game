// These are invitations to act on objects already introduced by the story, not new clues.
const beats = {
  O00: ['yunseo', '윤서', '함께 전시실로 가시죠.', '윤서와 출발하기'],
  S01: ['moro', '모로', '어느 흔적부터 따라가 볼까요?', '조사 방향 의논하기'],
  I01: ['moro', '모로', '다음 조사에 무엇을 가져갈까요?', '챙길 장비 정하기'],
  I02: ['desk', '표제 열람대', '확인한 기록을 바탕으로 챙길 자료를 골라 보세요.', '보존할 자료 고르기'],
  I03: ['valve', '배수 밸브', '흔적을 확인했습니다. 구조에 쓸 준비를 정하세요.', '구조 준비 정하기'],
  I04: ['yunseo', '윤서', '확인한 요청을 어떻게 남길지 이야기해 주세요.', '요청 처리 의논하기'],
  P11: ['terminal', '도장 작업대', '운송표의 조건대로 도장을 놓아 보세요.', '도장 배열하기'],
  P12: ['board', '시설 지도', '지도 위에 통행 가능한 길을 그려 보세요.', '운반 경로 그리기'],
  S12: ['moro', '모로', '누구의 설명부터 더 들어 볼까요?', '확인할 증언 정하기'],
  T21: ['moro', '모로', '작업 시각과 고장 시각을 함께 맞춰 볼까요?', '이송 순서 맞추기'],
  T22: ['yunseo', '윤서', '확인한 사실을 어떻게 기록할지 정해 주세요.', '진술 남기기'],
  D21: ['terminal', '기록 단말', '두 안내문을 대조해 확인한 범위를 정리하세요.', '기록 대조하기'],
  D22: ['valve', '배수 밸브', '확인한 배수선으로 구조 준비를 시작하세요.', '배수 작업 준비하기'],
  S22: ['yunseo', '윤서', '나래가 부탁한 약속을 함께 확인해요.', '나래의 부탁 확인하기'],
  P21: ['terminal', '인양 제어기', '안전 순서에 맞춰 장치를 조작하세요.', '인양 순서 조작하기'],
  R31: ['boat', '인양 장치', '두 함과 전원을 확인했습니다. 구조 방법을 정하세요.', '인양 방법 정하기'],
  R32: ['valve', '수동 제어판', '남은 전원으로 가능한 복구 방법을 정하세요.', '수동 복구 준비하기'],
  S31: ['terminal', '나래의 통신 단말', '구조 결과를 전했습니다. 인계할 일을 정하세요.', '나래와 인계 의논하기'],
  F31: ['boat', '종이배 포장대', '배의 상태에 맞춰 반환할 방법을 정하세요.', '반환 준비하기'],
  F32: ['desk', '정정 기록대', '확인한 근거로 남길 문장을 정하세요.', '정정 기록 남기기'],
  F33: ['moro', '모로', '전원과 기록을 확인했습니다. 인계를 준비하세요.', '모로 인계하기'],
  F34: ['ledger', '인계 목록', '물품과 책임을 목록에 남기고 떠날 준비를 하세요.', '마지막 인계 정하기'],
};

export const FIELD_ACTION_ID = 'field-action';

export function fieldActionFor(view) {
  const exploration = view?.exploration;
  const primary = exploration?.primaryAction;
  if (!primary || primary.kind === 'inspect' || !['exploring', 'input'].includes(view.phase))
    return null;
  if (primary.kind === 'choices' && !exploration.canChoose && !exploration.canPlanInvestigation)
    return null;
  const beat = view.sceneId === 'S01' && !exploration.canPlanInvestigation
    ? ['case', '빈 진열장', '유리와 잠금쇠의 흔적을 대조해 보세요.', primary.label]
    : beats[view.sceneId];
  if (!beat) return null;
  const [anchor, target, cue, label] = beat;
  const solved = exploration.deductionSolved && primary.kind === 'choices';
  return {
    id: FIELD_ACTION_ID,
    anchor,
    target,
    cue: solved ? '확인한 근거로 이제 실행할 일을 정하세요.' : cue,
    label: solved ? '실행할 일 정하기' : label,
    kind: 'action',
    visited: false,
    objective: `${target}${['moro', 'yunseo'].includes(anchor) ? '에게' : '에'} 다가가세요 · ${solved ? '실행할 일 정하기' : label}`,
  };
}

export function fieldHotspots(exploration, action) {
  const hotspots = exploration?.hotspots ?? [];
  if (!action) return hotspots;
  // E prioritizes the ready action, but notebook/conversation intents still need the original IDs.
  return [action, ...hotspots];
}
