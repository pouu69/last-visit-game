// Ambient lines describe observable work, never grant evidence or reveal a story answer.
const lines = {
  moro: {
    greet: ['궁금한 곳이 있나요? 함께 살펴볼 수 있어요.', '여기 있어요. 필요한 게 있으면 불러 주세요.'],
    inspect: ['주변에 걸리는 물건이 없는지 확인할게요.', '이쪽도 천천히 살펴봐야겠어요.'],
    rest: ['잠깐 멈춰서 주변을 확인할게요.', '서두르지 않아도 괜찮아요.'],
    roam: ['조금 둘러보고 올게요.', '돌아갈 길도 잘 봐 두어야겠어요.'],
    water: ['물가에서는 바퀴가 미끄러질 수 있어요.', '젖지 않은 바닥 쪽으로 움직일게요.'],
  },
  yunseo: {
    greet: ['물어볼 게 있으면 편하게 불러 주세요.', '직접 살펴보니 어떤가요?'],
    inspect: ['전시실은 돌아볼 때마다 눈에 들어오는 게 다르네요.', '너무 가까이 놓인 물건은 없는지 봐야겠어요.'],
    rest: ['조용해지니 발소리가 더 크게 들리네요.', '잠깐 숨을 돌려도 괜찮겠지요.'],
    roam: ['이쪽도 한 번 돌아봐야겠어요.', '마지막까지 공간을 잘 살펴야지요.'],
    water: ['젖은 바닥은 조심해 주세요.', '물건을 살피기 전에 발밑부터 확인해야겠어요.'],
  },
};

export function ambientLine(actorId, activity, sceneId, index, previousId) {
  const pool = lines[actorId];
  if (!pool) return null;
  const category = activity !== 'greet' && ['S22', 'P21', 'R31', 'R32'].includes(sceneId)
    ? 'water' : activity;
  const choices = pool[category] ?? pool.roam;
  const candidates = choices.map((text, offset) => ({ id: `${actorId}.${category}.${offset}`, text }));
  const available = candidates.filter((line) => line.id !== previousId);
  return available[index % available.length];
}

export function ambientActivity(actorId, index, hasInterest) {
  const cycle = actorId === 'moro' ? ['inspect', 'roam', 'rest', 'inspect'] : ['roam', 'rest', 'inspect', 'roam'];
  const activity = cycle[index % cycle.length];
  return activity === 'inspect' && !hasInterest ? 'roam' : activity;
}
