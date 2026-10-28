import { hasCorrectionEvidence } from '../route-rules.mjs';
import { messages, readManuscript, section } from './read-manuscript.mjs';

const scenes = readManuscript(new URL('../../docs/manuscript/chapter-3.md', import.meta.url));
const endings = readManuscript(new URL('../../docs/manuscript/endings.md', import.meta.url));

function paragraphs(source, heading) {
  return messages(section(source, heading));
}

function choiceSection(scene, choiceId) {
  const heading = [...scene.sections.keys()].find((key) => key.startsWith(`${choiceId} — `));
  if (!heading)
    throw new Error(`Choice "${choiceId}" is missing from ${scene.id}; choose A, B, C, or D.`);
  return { heading, raw: section(scene, heading) };
}

function powerHeading(flags) {
  return flags.moro === 'active' ? 'moro=active' : `moro=asleep AND battery=${flags.battery}`;
}

function insertAfter(list, prefix, addition) {
  const index = list.findIndex((message) => message.text.startsWith(prefix));
  if (index < 0)
    throw new Error(`Manuscript anchor "${prefix}" is missing; update its conditional insertion.`);
  return [...list.slice(0, index + 1), ...addition, ...list.slice(index + 1)];
}

function choicePresentation(sceneId, choiceId, flags) {
  if (sceneId === 'R31') {
    if (choiceId === 'A')
      return {
        detail:
          '배는 온전히 꺼냅니다. 원본 장부는 물에 번져 읽을 수 없게 됩니다. 모로의 전력은 남습니다.',
      };
    if (choiceId === 'B')
      return { detail: '원본 장부를 보존합니다. 배는 손상되며, 모로의 전력은 남습니다.' };
    if (choiceId === 'C')
      return {
        detail:
          '배와 원본을 온전히 꺼냅니다. 모로는 전력을 모두 쓰고 잠듭니다. 보조 배터리가 있다면 남습니다.',
      };
    if (flags.maintenance && flags.battery)
      return {
        label: '점검한 배수선과 배터리로 두 함을 꺼낸다',
        detail:
          '배수선 점검을 마쳤고 배터리가 있습니다. 배터리를 사용해 두 물건을 보존하고 모로의 전력을 남깁니다.',
      };
    return {
      label: '두 함을 밀봉하고 전문가에게 인계한다',
      detail:
        '외부 구조에 필요한 점검 또는 배터리가 부족합니다. 두 함은 보호되지만 사흘 뒤에 개봉하므로 내일 배를 보낼 수 없습니다.',
    };
  }
  if (sceneId === 'R32') {
    if (choiceId === 'A')
      return {
        detail:
          '수동 고리로 배를 꺼내지만 종이가 손상됩니다. 원본은 읽을 수 없게 되고 모로의 전력은 남습니다.',
      };
    if (choiceId === 'B')
      return {
        detail:
          '원본을 보존하고 손상된 배를 꺼냅니다. 레일을 받치는 모로는 전력을 모두 쓰고 잠듭니다.',
      };
    if (choiceId === 'C')
      return flags.battery
        ? {
            label: '비상 전원과 모로로 두 함을 꺼낸다',
            detail: '배터리와 모로의 전력을 모두 사용합니다. 배와 원본은 온전하며 모로는 잠듭니다.',
          }
        : {
            label: '모로의 전력으로 배를 먼저 구한다',
            detail:
              '보조 배터리가 없습니다. 배를 온전히 꺼내지만 원본은 읽을 수 없게 되고 모로는 잠듭니다.',
          };
    return flags.maintenance
      ? {
          label: '점검한 우회 통로로 배를 꺼낸다',
          detail:
            '배는 온전히 꺼내지만 원본에는 닿지 못합니다. 원본은 읽을 수 없게 되고 모로와 남은 전원은 그대로입니다.',
        }
      : {
          label: '두 함을 밀봉하고 전문가를 기다린다',
          detail:
            '우회 통로 점검을 마치지 못했습니다. 두 함을 보호하며 사흘 뒤에 개봉합니다. 내일 배를 보낼 수 없습니다.',
        };
  }
  if (sceneId === 'S31')
    return {
      detail: {
        A: '배의 상태에 맞는 발송·수리·편지·인계 방법을 다음에 정합니다. 지금 발송하지는 않습니다.',
        B: '현재 보존한 근거를 확인하고 전시 안내를 어떻게 고칠지 다음에 정합니다.',
        C: '모로의 현재 전원과 남은 장비를 보고 실제 이동 방법을 다음에 정합니다.',
        D: '물건의 위치와 개봉 일정, 반환 책임을 정리한 뒤 마지막 현장 행동을 고릅니다.',
      }[choiceId],
    };
  if (sceneId === 'F31') {
    if (choiceId === 'A')
      return {
        detail:
          flags.boat === 'intact'
            ? '온전한 배를 포장해 반환 발송을 접수합니다.'
            : '배가 손상됐거나 밀봉돼 있어 지금 발송할 수 없습니다. 상태 보고와 후속 반환 인계를 남깁니다.',
      };
    if (choiceId === 'B') {
      if (flags.boat === 'intact')
        return {
          label: '온전한 배를 그대로 포장해 반환한다',
          detail: '수리할 필요가 없습니다. 보수 도구를 소비하지 않고 발송합니다.',
        };
      if (flags.boat === 'sealed')
        return {
          label: '개봉 일정과 수리 의뢰를 남긴다',
          detail:
            '사흘 뒤 개봉하기 전에는 배를 수리하거나 보낼 수 없습니다. 보수 도구가 있어도 지금 사용하지 않습니다.',
        };
      if (flags.repair)
        return {
          label: '보수 도구로 배를 수리해 반환한다',
          detail:
            '나래가 허락한 범위로 수리합니다. 보수 도구를 사용하고 수리 위치를 기록한 뒤 발송합니다.',
        };
      return {
        label: '손상 보고와 수리 의뢰를 남긴다',
        detail:
          '보수 도구가 없어 지금 수리할 수 없습니다. 배는 손상된 상태로 보관하고 다음 담당자에게 넘깁니다.',
      };
    }
    return {
      detail:
        choiceId === 'C'
          ? '편지만 먼저 보냅니다. 배가 온전해도 이번에는 발송하지 않고 실제 인계 날짜를 협의합니다.'
          : '배의 반환은 윤서에게 맡깁니다. 모로를 직접 데리고 나가며 전원 상태는 바뀌지 않습니다.',
    };
  }
  if (sceneId === 'F32') {
    if (choiceId === 'A')
      return {
        detail: hasCorrectionEvidence(flags)
          ? '공식 시정에 필요한 근거를 갖췄습니다. 확인한 자료와 책임자의 이름으로 정정문을 게시합니다.'
          : '공식 시정에 필요한 자료 조합이 부족합니다. 검증 예정 안내와 익명 참여 전시를 남깁니다.',
      };
    if (choiceId === 'B') {
      if (flags.moro === 'active')
        return {
          label: '모로의 로그를 추출해 근거를 대조한다',
          detail:
            '모로가 작동하고 있어 배터리 없이 로그를 추출합니다. 기존 로그가 있어도 새 증거 두 건으로 세지는 않습니다.',
        };
      if (flags.battery)
        return {
          label: '배터리로 모로를 깨워 로그를 추출한다',
          detail:
            '남은 배터리를 사용해 모로를 켜고 로그를 얻습니다. 이후 자료 조합이 갖춰졌는지 확인합니다.',
        };
      return {
        label: '보존한 자료만 다시 대조한다',
        detail:
          '모로가 잠들었고 배터리가 없습니다. 새 로그는 얻지 못하며 현재 자료로 게시 가능한 범위를 확인합니다.',
      };
    }
    return {
      detail:
        choiceId === 'C'
          ? '자료 유무와 관계없이 공식 발표를 미룹니다. 개인 이름과 사연을 공개하지 않는 참여 전시를 엽니다.'
          : '자료 보관과 후속 확인은 윤서에게 맡기고 모로의 이동을 직접 마칩니다. 전원은 추가로 쓰지 않습니다.',
    };
  }
  if (sceneId === 'F33') {
    if (choiceId === 'A')
      return {
        detail:
          '정비 수레로 직접 옮깁니다. 전원 상태는 유지하며 배터리를 쓰거나 새 로그를 꺼내지 않습니다.',
      };
    if (choiceId === 'B') {
      if (flags.moro === 'active')
        return {
          label: '작동 중인 모로와 함께 나온다',
          detail: '현재 전원으로 이동합니다. 보조 배터리는 사용하지 않습니다.',
        };
      if (flags.battery)
        return {
          label: '남은 배터리로 모로를 깨워 함께 나온다',
          detail:
            '배터리를 실제로 사용해 다시 켭니다. 이동을 위한 충전이며 로그 추출은 하지 않습니다.',
        };
      return {
        label: '충전 의뢰를 붙여 잠든 모로를 옮긴다',
        detail: '지금 켤 전원이 없습니다. 잠든 채 안전하게 옮기고 다음 날 충전을 맡깁니다.',
      };
    }
    if (choiceId === 'C')
      return {
        detail:
          '접속부를 봉인해 몸과 기록을 작업실로 인계합니다. 전원은 그대로이며 미확인 로그를 읽은 것으로 처리하지 않습니다.',
      };
    return {
      detail:
        flags.boat === 'intact'
          ? '모로의 이동은 윤서에게 맡기고 온전한 배의 발송을 직접 접수합니다.'
          : '모로의 이동은 윤서에게 맡깁니다. 배는 지금 보낼 수 없어 손상·밀봉 상태와 후속 반환 절차를 인계합니다.',
    };
  }
  return {
    detail: {
      A: '침수 구역을 통제하고 물품의 상태·보관 위치·개봉 일정·담당자를 넘깁니다.',
      B: '실제로 보존한 자료만 대조해 들고 나옵니다. 읽을 수 없거나 밀봉된 원본이 새로 생기지는 않습니다.',
      C: '안뜰의 안전 통로로 마지막 방문객을 안내합니다. 물품과 반환 책임은 윤서에게 인계합니다.',
      D: '모로의 이동을 직접 맡습니다. 현재 전원 상태로 옮기며 배터리를 쓰거나 새 로그를 추출하지 않습니다.',
    }[choiceId],
  };
}

// Reviewed manuscript paragraphs stay in their authored order; state selects only explicit variants.
export function sceneContent(sceneId, flags, history) {
  const scene = scenes.get(sceneId);
  if (!scene) return null;
  let body = paragraphs(scene, '본문');
  const conditions = scene.sections.get('조건부 대사');
  if (sceneId === 'R31')
    body.push(
      ...paragraphs(
        conditions,
        flags.maintenance && flags.battery
          ? 'maintenance=true AND battery=true'
          : 'maintenance=false OR battery=false',
      ),
    );
  if (sceneId === 'R32') {
    body.push(...paragraphs(conditions, `battery=${flags.battery}`));
    body.push(...paragraphs(conditions, `maintenance=${flags.maintenance}`));
  }
  if (sceneId === 'S31') {
    body = insertAfter(body, '사람들은 안전한 곳에 있습니다.', [
      ...paragraphs(conditions, `boat=${flags.boat}: 구조 상태 알림의 배 문단`),
      ...paragraphs(conditions, `record=${flags.record}: 구조 상태 알림의 원본 문단`),
    ]);
    body = insertAfter(
      body,
      '부탁드려요. 그리고 배를 옮긴 안내원은',
      paragraphs(conditions, `moro=${flags.moro}: 모로 상태 알림`),
    );
    body = body.map((message) =>
      message.text.startsWith('나래 씨. 전시 설명을 제가 바꿨어요.')
        ? { ...message, facts: ['request_received', 'return_delayed', 'return_clause_removed'] }
        : message,
    );
  }
  if (sceneId === 'F32')
    body.push(...paragraphs(conditions, `evidence=${hasCorrectionEvidence(flags)}`));
  if (sceneId === 'F32' || sceneId === 'F33')
    body.push(...paragraphs(conditions, powerHeading(flags)));
  const choices = [...'ABCD'].map((id) => ({
    id,
    label: choiceSection(scene, id).heading.slice(4),
    ...choicePresentation(sceneId, id, flags),
  }));
  return {
    id: sceneId,
    title: scene.title,
    chapter: 3,
    messages: body,
    choices,
    hints: [],
    npc: sceneId === 'S31' ? 'nara' : null,
  };
}

// before determines resources available at the decision; after determines its actual outcome.
export function resultContent(sceneId, choiceId, before, after, history) {
  const scene = scenes.get(sceneId);
  if (!scene) return null;
  const { raw } = choiceSection(scene, choiceId);
  if (sceneId === 'R31' && choiceId === 'D')
    return paragraphs(
      raw,
      before.maintenance && before.battery
        ? 'maintenance=true AND battery=true: 점검한 배수선과 배터리로 둘 다 꺼낸다'
        : 'maintenance=false OR battery=false: 두 함을 밀봉하고 전문가에게 인계한다',
    );
  if (sceneId === 'R32' && choiceId === 'C')
    return paragraphs(
      raw,
      before.battery
        ? 'battery=true: 비상 전원과 모로로 두 함을 꺼낸다'
        : 'battery=false: 모로의 전력으로 배를 먼저 구한다',
    );
  if (sceneId === 'R32' && choiceId === 'D')
    return paragraphs(
      raw,
      before.maintenance
        ? 'maintenance=true: 점검한 우회 통로로 배를 꺼낸다'
        : 'maintenance=false: 두 함을 밀봉하고 전문가를 기다린다',
    );
  if (sceneId === 'F31' && choiceId === 'A')
    return paragraphs(
      raw,
      before.boat === 'intact' ? 'boat=intact' : 'boat=damaged OR boat=sealed',
    );
  if (sceneId === 'F31' && choiceId === 'B')
    return paragraphs(
      raw,
      before.boat === 'damaged'
        ? `boat=damaged AND repair=${before.repair}`
        : `boat=${before.boat}`,
    );
  if (sceneId === 'F32' && choiceId === 'A')
    return paragraphs(raw, `evidence=${hasCorrectionEvidence(before)}`);
  if (sceneId === 'F32' && choiceId === 'B')
    return [
      ...paragraphs(raw, powerHeading(before)),
      ...paragraphs(raw, `처리 후 evidence=${hasCorrectionEvidence(after)}`),
    ];
  if (sceneId === 'F33' && choiceId === 'B') return paragraphs(raw, powerHeading(before));
  if (sceneId === 'F33' && choiceId === 'D')
    return [
      ...messages(raw.split(/^#### /m)[0]),
      ...paragraphs(raw, before.boat === 'intact' ? 'boat=intact' : 'boat=damaged OR boat=sealed'),
    ];
  return messages(raw);
}

// Final history retains consumed resources for epilogues; final flags alone cannot describe them.
export function endingContent(endingId, flags, history) {
  const ending = endings.get(endingId);
  if (!ending || !/^E[1-6]$/.test(endingId)) return null;
  const body = paragraphs(ending, '본문');
  const conditions = section(ending, '조건부 후일담');
  const last = history.at(-1);
  const lastChoice = last ? `${last.sceneId}-${last.choiceId}` : null;
  const before = last?.before ?? flags;
  let powerDescribed = false;

  if (endingId === 'E1') {
    if (lastChoice === 'F31-B' && before.boat === 'damaged' && before.repair)
      body.push(
        ...paragraphs(conditions, '마지막 선택=F31-B AND 선택 전 boat=damaged AND repair=true'),
      );
    if (lastChoice === 'F33-D') body.push(...paragraphs(conditions, '마지막 선택=F33-D'));
  }
  if (endingId === 'E2') {
    body.push(
      ...paragraphs(
        conditions,
        flags.boat === 'intact' ? 'boat=intact AND 마지막 선택=F31-C' : `boat=${flags.boat}`,
      ),
    );
    if (lastChoice === 'F31-B' && flags.boat === 'damaged')
      body.push(...paragraphs(conditions, '마지막 선택=F31-B AND boat=damaged'));
    if (lastChoice === 'F33-D') body.push(...paragraphs(conditions, '마지막 선택=F33-D'));
  }
  if (endingId === 'E3' && lastChoice === 'F32-B') {
    body.push(...paragraphs(conditions, `마지막 선택=F32-B AND 선택 전 ${powerHeading(before)}`));
    powerDescribed = before.moro === 'asleep' && before.battery;
  }
  if (endingId === 'E4') {
    body.push(
      ...paragraphs(
        conditions,
        lastChoice === 'F32-C' ? '마지막 선택=F32-C' : '마지막 선택=F32-A OR 마지막 선택=F32-B',
      ),
    );
    if (lastChoice === 'F32-B' && before.moro === 'asleep' && before.battery)
      body.push(
        ...paragraphs(conditions, '마지막 선택=F32-B AND 선택 전 moro=asleep AND battery=true'),
      );
  }
  if (endingId === 'E5') {
    let condition = `method=${flags.method}`;
    if (flags.method === 'recharge') {
      condition =
        before.moro === 'active'
          ? 'method=recharge AND 선택 전 moro=active'
          : before.battery
          ? 'method=recharge AND 선택 전 moro=asleep AND battery=true'
          : 'method=recharge AND moro=asleep';
      powerDescribed = true;
    }
    body.push(...paragraphs(conditions, condition));
  }
  if (endingId === 'E6') body.push(...paragraphs(conditions, `method=${flags.method}`));

  const common = endings.get('공통 상태 후일담');
  if (!['E1', 'E2'].includes(endingId))
    body.push(...paragraphs(common, `E3/E4/E5/E6 AND boat=${flags.boat}`));
  body.push(...paragraphs(common, `record=${flags.record}`));
  if (!powerDescribed) body.push(...paragraphs(common, `moro=${flags.moro}`));
  if (flags.lead) body.push(...paragraphs(endings.get('첫 조사 경로 회수'), `lead=${flags.lead}`));
  return {
    id: endingId,
    title: ending.title,
    chapter: 3,
    messages: body,
    choices: [],
    hints: [],
    npc: null,
  };
}
