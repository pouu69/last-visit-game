// Authored investigation beats partition the manuscript; route effects still belong to route-rules.
const scenes = {
  O00: {
    objective: '초대장을 확인하고 로비의 관장 윤서를 만나세요.',
    groups: [
      [
        'invitation',
        '초대장 확인하기',
        'invitation',
        1,
        '폐관일의 마지막 야간 관람에 초대받았다. 오늘은 방문객으로 전시를 둘러본다.',
      ],
      [
        'curator',
        '윤서와 인사하기',
        'yunseo',
        5,
        '관장 윤서의 안내를 받았다. 제1 전시실에서 첫 전시품을 함께 살펴보기로 했다.',
      ],
    ],
    required: ['invitation', 'curator'],
    hotspotRequires: { curator: ['invitation'] },
    guidance: {
      invitation: {
        objective: '눈앞의 초대장을 확인하세요.',
        reason:
          '여러분은 폐관일의 마지막 야간 관람객입니다. 먼저 오늘의 방문 목적을 확인합니다.',
      },
      curator: {
        objective: '로비를 걸어 관장 윤서에게 다가가세요.',
        reason: '초대장을 확인했습니다. 관장의 안내를 받아 마지막 전시 관람을 시작합니다.',
      },
      ready: {
        objective: '윤서와 함께 제1 전시실로 이동하세요.',
        reason: '관람 안내를 받았습니다. 이제 박물관이 처음 전시한 물건을 직접 살펴봅니다.',
      },
    },
  },
  S01: {
    objective: '빈 진열장을 조사하고, 사라진 배를 어디서부터 찾을지 정하세요.',
    groups: [
      [
        'case',
        '빈 진열장 살펴보기',
        'case',
        2,
        '제1호 종이배의 받침만 비어 있다. 유리와 잠금쇠에는 깨진 흔적이 없다.',
      ],
      [
        'trail',
        '모로와 젖은 흔적',
        'moro',
        '복도 끝에서',
        '모로의 집게에 젖은 종이 조각이 붙어 있고, 바닥에는 두 줄의 물자국이 있다. 조각의 정체는 아직 모른다.',
      ],
      [
        'schedule',
        '벽의 일정표 펼치기',
        'board',
        '벽의 일정표에는',
        '내일 아침 9시에 배를 띄운다. 밀봉 물품은 사흘 뒤 개봉하므로 두 일정은 맞지 않는다.',
      ],
    ],
    required: ['case'],
    deduction: {
      prompt: '깨지지 않은 유리와 제자리의 잠금쇠. 지금 확실히 말할 수 있는 것은?',
      requires: ['case'],
      options: [
        ['broken', '유리를 깨고 배를 꺼냈다'],
        ['trace', '유리를 깨뜨려 가져간 흔적은 없다'],
        ['culprit', '열쇠를 가진 윤서가 배를 가져갔다'],
        ['intact', '유리가 온전하니 사라진 배도 반드시 온전하다'],
      ],
      answer: 'trace',
      success:
        '강제로 깨뜨린 흔적이 없다는 관찰과, 누가 배를 옮겼다는 추측은 다릅니다. 이제 다음 조사 대상을 정할 수 있습니다.',
      retry:
        '유리는 온전합니다. 그러나 열쇠를 가졌다는 사실만으로 누가 배를 옮겼는지 확정할 수는 없습니다. 관찰이 증명하는 범위로 다시 좁혀 보세요.',
    },
  },
  I01: {
    objective: '젖은 종이의 정체를 확인하고, 다음 조사에 쓸 자료나 장비를 챙기세요.',
    groups: [
      [
        'receipt',
        '모로의 집게와 화면',
        'moro',
        2,
        '조각은 종이배가 아니라 고장 신고용 접수표다. 이송 완료와 수령 대기는 서로 다른 상태다.',
      ],
      [
        'supplies',
        '작업 단말과 비상함',
        'battery',
        '벽의 작은 단말에',
        '단말의 기록과 요청서, 공용 배터리, 통로 도면 중 하나를 먼저 확보할 수 있다.',
      ],
    ],
    required: ['receipt'],
  },
  I02: {
    objective: '덧붙인 표제 아래를 확인하고 원래의 약속을 찾으세요.',
    groups: [
      [
        'label',
        '들린 표제 모서리',
        'desk',
        2,
        '새 표제 아래에는 준비가 되면 돌려준다는 문장이 남아 있다. 누가 언제 덮었는지는 아직 모른다.',
      ],
      [
        'archive',
        '규약 사본과 접수 목록',
        'terminal',
        '열람대 단말에는',
        '규약 사본과 최근 접수 목록은 다른 문서다. 원본 장부는 지하 고정 보관함에 있다.',
      ],
      [
        'supplies',
        '비상함 위치와 도면',
        'board',
        '열람대 옆에는',
        '공용 비상 배터리는 하나다. 기록 보존과 구조 준비 중 다음 행동을 정한다.',
      ],
    ],
    required: ['label'],
  },
  I03: {
    objective: '빗물과 누수, 바퀴의 이동을 구분해서 조사하세요.',
    groups: [
      [
        'water',
        '젖은 벽과 바퀴 자국',
        'valve',
        2,
        '시설 기록의 누수 시작은 20시 25분이다. 모든 통로가 동시에 젖은 것은 아니며 바퀴는 물을 피해 돌아갔다.',
      ],
      [
        'panel',
        '밸브 보호판',
        'board',
        '벽의 배수 밸브는',
        '보호판 옆에서 관리 통로 도면과 비상함 위치를 확인할 수 있다.',
      ],
      [
        'terminal',
        '안뜰 단말 확인',
        'terminal',
        '안뜰 단말은',
        '접수 기록과 이동 로그를 살필 수 있다. 물의 출발지와 물건의 목적지는 별도로 확인해야 한다.',
      ],
    ],
    required: ['water'],
  },
  I04: {
    objective: '윤서의 설명을 열쇠와 접수 기록에 비춰 확인하세요.',
    groups: [
      [
        'key',
        '열쇠 꼬리표',
        'desk',
        2,
        '닳은 꼬리표는 오래 소지했다는 흔적이다. 어제 사용했다는 증거는 아니다.',
      ],
      [
        'promise',
        '개관 사진 아래 메모',
        'board',
        '책상 뒤 개관 사진이',
        '개관 사진 아래에는 그날이 오면 돌려주기라는 약속이 적혀 있다.',
      ],
      [
        'receipt',
        '윤서에게 접수 서류 묻기',
        'yunseo',
        '돌려달라고 연락한',
        '윤서는 전날 나래의 반환 요청을 받았다고 인정했다. 아직 서명 진술을 받은 것은 아니다.',
      ],
    ],
    required: ['receipt'],
  },
  P11: {
    objective: '운송표의 네 조건을 읽고 도장을 직접 배열하세요.',
    groups: [
      [
        'manifest',
        '젖은 운송표 읽기',
        'terminal',
        2,
        '종과 물결 사이 한 칸, 종 바로 뒤의 잎, 물결과 잎보다 뒤의 별. 네 도장을 각각 한 번 사용한다.',
      ],
    ],
    required: ['manifest'],
    puzzle: 'stamps',
  },
  P12: {
    objective: '시설 운반로를 검증해 정비 도면을 확보하고, 관람 복도로 반환실에 합류하세요.',
    groups: [
      [
        'map',
        '시설 운반로 지도',
        'board',
        2,
        '침수 구역의 운반로를 검증한다. 기록실에서 반환실로 향하는 운반 구간은 막혔으며, 우리가 걷는 관람 복도와는 다른 도면이다.',
      ],
      [
        'reward',
        '모로에게 길 안내 묻기',
        'moro',
        '구간 수가 걸리는',
        '숫자는 시설 운반 거리를 비교하는 구간 수다. 검증하면 정비 도면을 얻고, 사람은 관람 복도로 반환실에 합류한다.',
      ],
    ],
    required: ['map'],
    puzzle: 'route',
  },
  S12: {
    objective: '모로의 설명과 윤서의 반응을 듣고, 누구의 설명부터 확인할지 정하세요.',
    groups: [
      [
        'admission',
        '모로의 첫 설명 듣기',
        'moro',
        2,
        '모로는 배를 반환실 수령 대기 위치로 옮겼다고 말했다. 윤서는 설명을 중단시켰다.',
      ],
      [
        'interruption',
        '윤서의 열쇠와 반응',
        'yunseo',
        '윤서가 문에 손을',
        '누가 옮겼는지와 어떤 요청·절차로 옮겼는지는 서로 다른 질문이다.',
      ],
    ],
    required: ['admission'],
  },
  T21: {
    objective: '모로의 작업 기록에서 이송과 고장의 순서를 맞춰 보세요.',
    groups: [
      [
        'order',
        '모로의 작업 명령 확인',
        'moro',
        2,
        '반환 요청과 기존 규약에 따라 20시 35분에 배를 옮겼다. 이송은 완료됐지만 반환은 끝나지 않았다.',
      ],
      [
        'fault',
        '고장 시각과 접수표',
        'terminal',
        '그런데 물이 차는',
        '이송 당시 통로는 말라 있었다. 20시 38분 레일이 멈춘 뒤 고장을 알리러 나오며 물을 밟았다.',
      ],
      [
        'records',
        '남길 기록과 구조 준비',
        'battery',
        '요청한 사람과 옮긴',
        '실행 로그는 규약과 시각, 요청서는 소유자의 반환 시점을 증명한다. 실제 구조에는 전원과 통로가 필요하다.',
      ],
    ],
    required: ['order', 'fault'],
    deduction: {
      prompt: '20:35 이송, 20:38 레일 정지. 젖은 바퀴를 어떻게 해석해야 할까요?',
      requires: ['order', 'fault'],
      options: [
        ['flood', '처음부터 침수된 통로로 배를 옮겼다'],
        ['after', '이송 뒤 고장을 알리러 나오며 물을 밟았다'],
        ['destroyed', '종이배가 찢어져 집게에 붙었다'],
        ['cancelled', '레일이 멈췄으니 반환 요청 자체가 취소되었다'],
      ],
      answer: 'after',
      success:
        '작업 시각과 고장 시각을 구분했습니다. 젖은 흔적만으로 최초 이동 경로의 상태를 단정하지 않습니다.',
      retry:
        '이송은 20시 35분, 레일 정지는 20시 38분입니다. 집게의 조각은 접수표입니다. 두 시각 사이의 순서를 다시 확인하세요.',
    },
  },
  T22: {
    objective: '윤서의 주장을 듣고 보존한 단서로 직접 추궁하세요.',
    groups: [
      [
        'account',
        '윤서의 설명 듣기',
        'yunseo',
        2,
        '윤서가 밝힌 요청 수신 여부를 기록했다. 이미 인정받은 사실은 다음 질문에서도 유지된다.',
      ],
      [
        'records',
        '접수 단말과 기록 대조',
        'terminal',
        '여러분은 지금까지 들은',
        '보존한 자료를 골라 윤서의 주장과 대조할 수 있다. 말로 인정받는 것과 서명 진술을 남기는 것은 다르다.',
      ],
    ],
    required: ['account'],
  },
  D21: {
    objective: '원래 규약과 현재 안내를 대조하고, 무엇이 바뀌었는지 확인하세요.',
    groups: [
      [
        'ledger',
        '유리 너머 원본 장부',
        'ledger',
        2,
        '원본은 고정 함 안에 있다. 화면의 규약 사본을 읽는 것과 원본을 꺼내는 것은 다르다.',
      ],
      [
        'compare',
        '두 안내문 나란히 보기',
        'terminal',
        '옛 규약 옆으로',
        '현재 안내에서는 반환 조항이 빠졌다. 실제 처리 여부는 실행 로그 또는 요청서와 대조해야 한다.',
      ],
      [
        'tools',
        '문서 보존함과 도구',
        'desk',
        '단말 아래에는',
        '보수 도구는 찢어진 종이를 붙인다. 물에 번져 사라진 잉크를 되돌리지는 못한다.',
      ],
    ],
    required: ['compare'],
    deduction: {
      prompt: '반환 조항이 빠진 안내문으로 어디까지 확인할 수 있을까요?',
      requires: ['compare'],
      options: [
        ['both', '안내 변경과 모든 반환 거부가 함께 증명된다'],
        ['change', '안내 변경은 확인되지만 실제 처리는 다른 기록이 필요하다'],
        ['copy', '사본이 있으니 원본 장부를 구한 것과 같다'],
        ['void', '안내에서 조항이 빠졌으니 원래 규약도 자동 취소되었다'],
      ],
      answer: 'change',
      success:
        '규칙과 실제 처리를 나눠 확인했습니다. 공식 시정을 위해 어떤 자료를 보존할지 결정하세요.',
      retry:
        '두 안내문은 문구의 차이를 보여 줍니다. 실제 요청을 받고 어떻게 처리했는지는 접수·실행 기록에서 확인해야 합니다.',
    },
  },
  D22: {
    objective: '밸브와 보조 레일을 살펴보고 구조에 필요한 준비를 정하세요.',
    groups: [
      [
        'valve',
        '번호가 남은 밸브',
        'valve',
        2,
        '유입 차단, 배수, 인양 준비는 다른 작업이다. 손잡이 번호를 도면과 대조해야 한다.',
      ],
      [
        'rail',
        '배수선과 레일 점검구',
        'terminal',
        '바닥을 따라가는 선이',
        '외부 구조에는 점검된 배수선·보조 레일과 비상 전원이 함께 필요하다.',
      ],
      [
        'supplies',
        '비상함과 정비 수레',
        'battery',
        '시설 안내판의 가장자리에',
        '도면이 없는 상태에서는 위치를 확인하고 도면을 얻는다. 도면 확보만으로 점검이 완료되지는 않는다.',
      ],
    ],
    required: ['valve', 'rail'],
  },
  S22: {
    objective: '나래가 남긴 기록과 요청을 비교하고, 구조 전에 지킬 것을 정하세요.',
    groups: [
      [
        'story',
        '사진 뒷면의 원래 기록',
        'desk',
        2,
        '나래가 맡긴 약속은 이웃들과 함께 배를 띄우는 날이다. 윤서는 이를 다른 전시 설명으로 바꿨다.',
      ],
      [
        'request',
        '반환 요청과 윤서의 인정',
        'yunseo',
        '사진 옆에 전날',
        '나래는 내일 아침 이웃들과 만나려 한다. 윤서는 반환 조항을 빼고 요청 처리를 미뤘음을 인정했다.',
      ],
      [
        'rescue',
        '격벽 너머 구조 장치',
        'boat',
        '단말의 화면이 반환실',
        '배·원본·모로 전력은 따로 지켜야 한다. 외부 장비 준비 여부가 두 함 구조에 영향을 주며 밀봉은 사흘 뒤 개봉한다.',
      ],
    ],
    required: ['story', 'request', 'rescue'],
    hotspotRequires: { request: ['story'], rescue: ['request'] },
    deduction: {
      prompt: '나래의 원래 기록과 어제의 요청에서 이어지는 약속은 무엇인가요?',
      requires: ['story', 'request'],
      options: [
        ['past', '아버지를 다시 만나기 위해 배를 계속 전시한다'],
        ['tomorrow', '이웃들과 내일 배를 띄우려고 맡긴 배를 돌려받는다'],
        ['seal', '사흘 뒤 개봉해도 내일 원래 배를 쓸 수 있다'],
        ['display', '전시 설명이 더 감동적이므로 소유자의 뜻보다 우선한다'],
      ],
      answer: 'tomorrow',
      success:
        '나래가 바라는 내일을 확인했습니다. 그 약속을 위해 어떤 구조 준비를 남길지 결정하세요.',
      retry:
        '전시 설명과 소유자가 남긴 말은 다릅니다. 나래의 요청에는 내일 아침 9시, 이웃들과 함께라는 말이 있습니다.',
    },
  },
  P21: {
    objective: '인양 작업을 순서대로 예약하세요. 아직 함은 움직이지 않습니다.',
    groups: [
      [
        'sequence',
        '제어기 안전 순서',
        'terminal',
        2,
        '유입 차단 뒤 레일 고정, 고정 뒤 인양, 인양 뒤 전원 해제. 작업은 각각 한 번 수행한다.',
      ],
      [
        'interlock',
        '안전 장치와 수동 복구',
        'valve',
        '순서가 맞으면 자동',
        '검증에 실패해도 위험한 순서는 실행되지 않는다. 자동 모드 대신 수동 복구로 진행한다.',
      ],
    ],
    required: ['sequence', 'interlock'],
    puzzle: 'crane',
  },
  R31: {
    objective: '두 함의 위험과 쓸 수 있는 전원을 확인한 뒤 구조하세요.',
    groups: [
      [
        'crates',
        '종이배와 장부의 두 함',
        'boat',
        2,
        '한 번의 인양으로 먼저 구하지 못한 쪽은 물에 노출된다. 격벽을 열고 들어갈 수는 없다.',
      ],
      [
        'power',
        '모로 전원과 외부 장비',
        'battery',
        '모로가 자신의 전원',
        '모로 전력으로 두 함을 구하면 모로는 잠든다. 외부 인양에는 점검 완료와 배터리가 모두 필요하다.',
      ],
    ],
    required: ['crates', 'power'],
  },
  R32: {
    objective: '수동 고리와 남은 전원을 대조해 가능한 구조 방법을 고르세요.',
    groups: [
      [
        'hook',
        '수동 고리의 도달 범위',
        'boat',
        2,
        '배를 수동으로 끌어내면 찢어질 수 있다. 장부 구조에는 모로가 레일을 붙잡아야 한다.',
      ],
      [
        'power',
        '비상 전원과 모로',
        'battery',
        '보조 배터리가 있으면',
        '보조 배터리를 쓰는 복구도 모로의 전력을 함께 사용한다. 모로가 잠들면 새 로그를 꺼낼 수 없다.',
      ],
      [
        'bypass',
        '우회 통로와 밀봉 안내',
        'valve',
        '제어판의 우회 통로',
        '통로 위치 확인과 사용 가능한 점검 완료는 다르다. 준비가 부족하면 사흘 뒤 개봉할 밀봉 인계를 선택할 수 있다.',
      ],
    ],
    required: ['hook', 'power', 'bypass'],
  },
  S31: {
    objective: '나래에게 실제 구조 상태를 알리고 반환과 공개 범위를 확인하세요.',
    groups: [
      [
        'report',
        '나래에게 구조 결과 전하기',
        'terminal',
        2,
        '배와 원본의 실제 상태를 나눠 전달했다. 구조하지 않은 물건을 보냈다고 말하지 않는다.',
      ],
      [
        'promise',
        '나래의 내일과 수령지',
        'desk',
        '내일 아침 아홉 시에',
        '나래의 약속과 수령인·주소를 확인했다. 준비되면 돌려받기로 한 배다.',
      ],
      [
        'consent',
        '공개 범위와 모로 인계',
        'moro',
        '잘못된 안내를 고친다면',
        '이름과 이웃들과 배를 띄우려 했다는 뜻은 공개할 수 있다. 사진과 주소는 공개하지 않는다. 모로의 이동 책임도 남겨야 한다.',
      ],
    ],
    required: ['report', 'promise', 'consent'],
  },
  F31: {
    objective: '배의 상태와 가진 도구에 맞는 반환 방법을 확정하세요.',
    groups: [
      [
        'condition',
        '배의 포장·수리 상태 확인',
        'boat',
        2,
        '온전한 배, 손상된 배, 밀봉된 배는 같은 발송으로 처리할 수 없다. 보수 도구도 확인해야 한다.',
      ],
      [
        'handoff',
        '반환 접수와 편지',
        'terminal',
        '밀봉한 배는 여기서',
        '사흘 뒤 개봉할 배를 지금 보냈다고 기록할 수 없다. 편지와 책임 있는 인계도 남길 수 있다.',
      ],
    ],
    required: ['condition'],
  },
  F32: {
    objective: '정정할 문장과 근거를 대조하고 공개 방식을 정하세요.',
    groups: [
      [
        'evidence',
        '원문과 정정 근거',
        'desk',
        2,
        '박물관의 규약 변경 근거와 나래가 직접 밝힌 뜻은 구분한다. 서명 진술 또는 규약·처리 기록의 조합을 확인한다.',
      ],
      [
        'power',
        '모로 로그와 남은 전원',
        'moro',
        '모로의 추가 로그를',
        '이미 보존한 로그는 읽을 수 있다. 잠든 모로에게서 새 로그를 받으려면 남은 배터리가 필요하다.',
      ],
    ],
    required: ['evidence', 'power'],
  },
  F33: {
    objective: '모로의 전원·기록·이동 경로를 확인해 인계하세요.',
    groups: [
      [
        'record',
        '모로와 남은 기록',
        'moro',
        2,
        '몸을 옮기는 것과 내부 로그를 추출하는 것은 다르다. 배와 원본의 구조 결과도 그대로 남는다.',
      ],
      [
        'handoff',
        '정비 수레와 인계 경로',
        'exit',
        '봉인해서 기록과 함께',
        '모로의 수령 장소와 이동 담당자를 정해야 한다. 잠들었다면 충전 조건도 함께 넘긴다.',
      ],
    ],
    required: ['record'],
  },
  F34: {
    objective: '남길 물품·기록·이동 책임을 확인하고 마지막 행동을 정하세요.',
    groups: [
      [
        'inventory',
        '밀봉 함과 원본 목록',
        'ledger',
        2,
        '밀봉 함은 사흘 뒤 전문가가 개봉한다. 원본과 먼저 확보한 사본 자료는 별도로 인계한다.',
      ],
      [
        'exit',
        '안전 통로와 이동 담당자',
        'exit',
        '안뜰 쪽으로 안전하게',
        '현관은 열려 있다. 모로의 위치와 이동 책임을 확인한 뒤 떠난다.',
      ],
    ],
    required: ['inventory'],
  },
};

const puzzles = {
  stamps: {
    kind: 'order',
    title: '운송표 복원',
    instructions: [
      '종과 물결 사이에는 도장이 정확히 하나 있다.',
      '잎은 종 바로 다음이다.',
      '별은 물결보다 뒤다.',
      '별은 잎보다 뒤다.',
    ],
    pieces: [
      { id: 'bell', label: '종' },
      { id: 'leaf', label: '잎' },
      { id: 'wave', label: '물결' },
      { id: 'star', label: '별' },
    ],
  },
  crane: {
    kind: 'order',
    title: '인양 순서 예약',
    instructions: [
      '유입 차단 뒤 레일을 고정한다.',
      '레일 고정 뒤 함을 인양한다.',
      '함을 인양한 뒤에 전원을 해제한다.',
      '검증만 수행한다. 실제 구조 대상과 전원은 다음 단계에서 결정한다.',
    ],
    pieces: [
      { id: 'shut', label: '유입 차단' },
      { id: 'brace', label: '레일 고정' },
      { id: 'lift', label: '함 인양' },
      { id: 'power', label: '전원 해제' },
    ],
  },
  route: {
    kind: 'path',
    title: '침수 구역의 운반 경로',
    instructions: [
      '이 도면은 침수 구역 안쪽의 운반 통로입니다. 현재 걷는 관람 복도와는 다릅니다.',
      '입구에서 반환실까지 화살표 방향으로 연결하세요.',
      '기록실 → 반환실 구간은 침수로 통행할 수 없습니다.',
      '안전하게 통행할 수 있는 길 중 구간 수가 가장 적은 길을 찾으세요.',
    ],
    pieces: [],
    nodes: [
      { id: 'entrance', label: '입구', x: 10, y: 50 },
      { id: 'office', label: '관장실', x: 30, y: 12 },
      { id: 'archive', label: '기록실', x: 53, y: 22 },
      { id: 'pump', label: '펌프실', x: 48, y: 52 },
      { id: 'garden', label: '안뜰', x: 40, y: 85 },
      { id: 'return', label: '반환실', x: 88, y: 50 },
    ],
    edges: [
      { from: 'entrance', to: 'archive', cost: 2, blocked: false },
      { from: 'archive', to: 'return', cost: 2, blocked: true },
      { from: 'entrance', to: 'pump', cost: 3, blocked: false },
      { from: 'pump', to: 'return', cost: 2, blocked: false },
      { from: 'entrance', to: 'garden', cost: 2, blocked: false },
      { from: 'garden', to: 'return', cost: 5, blocked: false },
      { from: 'entrance', to: 'office', cost: 1, blocked: false },
      { from: 'office', to: 'archive', cost: 1, blocked: false },
    ],
  },
};

/** Split only at authored anchors so conditional dialogue stays with its scene object. */
export function investigationFor(sceneId, content, flags, guidedVisit = false) {
  if (/^E[1-6]$/.test(sceneId)) return null;
  const spec = scenes[sceneId];
  if (!spec) throw new Error(`Investigation scene ${sceneId} needs an authored encounter.`);
  const indices = spec.groups.map((group) =>
    typeof group[3] === 'number'
      ? group[3]
      : content.messages.findIndex((message) => message.text.startsWith(group[3]))
  );
  if (indices.some((index, i) => index < 0 || (i > 0 && index <= indices[i - 1]))) {
    throw new Error(
      `Investigation anchors for ${sceneId} no longer match the manuscript. Update the scene groups.`
    );
  }
  const replacements =
    sceneId === 'P12'
      ? {
          '반환실 접근 안내판 앞에서 모로가 발을 멈춘다. 낡은 도면 위로 현재 통행 상태를 적은 표시가 덧붙어 있다.':
            '중앙 로비의 시설 단말 앞에서 모로가 발을 멈춘다. 화면에는 침수 구역 안쪽의 운반로와 현재 통행 상태가 표시되어 있다.',
          '목적지는 반환실입니다. 지금 이용할 수 있는 길 중 구간 수가 가장 적은 길을 골라 주세요.':
            '이 도면은 시설 장비의 운반 통로입니다. 우리가 걷는 관람 복도와는 다릅니다. 장비가 반환실까지 갈 수 있는 가장 짧은 길을 검증해 주세요.',
          '막힌 길을 먼저 빼야 합니다. 짧아도 지나갈 수 없으면 도착할 수 없습니다.':
            '막힌 운반로를 먼저 빼야 합니다. 짧아도 지나갈 수 없으면 장비가 반환실에 도착할 수 없습니다.',
          '표시된 화살표 방향으로만 이동할 수 있습니다. 표에 없는 연결은 사용할 수 없습니다.':
            '도면의 운반 장비는 표시된 화살표 방향으로만 움직입니다. 표에 없는 연결은 사용할 수 없습니다.',
          '이 도면에서 길을 비교하기 위한 수입니다. 여러분이 생각하는 동안 줄어드는 숫자는 아닙니다.':
            '장비의 운반 거리를 비교하는 구간 수입니다. 여러분이 생각하는 동안 줄어드는 숫자는 아닙니다.',
          '올바른 접근로를 고르면 통로의 정비 자료함에서 추가 도면을 받을 수 있다. 다른 길을 골라도 안전 확인 뒤 이용 가능한 길로 안내받는다.':
            '시설 운반로를 검증하면 단말 옆 정비 자료함이 열리고 배수 통로 도면을 받을 수 있다. 검증에 실패해도 관람 복도는 이용할 수 있다.',
          '위험한 통로에 들어가 보면서 확인할 필요는 없습니다. 여기서 도면을 함께 봐 주세요.':
            '침수 구역에 들어갈 필요는 없습니다. 여기서 검증을 마치면 우리는 관람 복도로 반환실 앞에 합류합니다.',
        }
      : guidedVisit && sceneId === 'S22'
      ? {
          '단말의 화면이 반환실 내부로 바뀐다. 왼쪽 함에는 종이배, 오른쪽 함에는 원본 장부가 있다. 두 함은 서로 다른 레일 아래에 잠겨 있다.':
            '단말의 화면이 반환실 내부로 바뀐다. 왼쪽 함에는 종이배, 오른쪽 함에는 원본 장부가 있다. 두 함은 서로 다른 레일 아래에 잠겨 있다. 단말 옆 반환실 측 공용 조작반에는 안뜰과 같은 배수선·보조 레일 번호가 붙어 있다.',
          '밖의 배수선과 보조 레일을 준비하고 비상 전원까지 쓰면, 두 함을 꺼낼 방법이 있어요. 준비가 부족하면 무엇부터 구할지 골라야 합니다.':
            '배수선과 보조 레일은 반환실 측 이 공용 조작반에서도 준비할 수 있어요. 비상 전원까지 쓰면 두 함을 꺼낼 방법이 있어요. 준비가 부족하면 무엇부터 구할지 골라야 합니다.',
        }
      : guidedVisit
      ? {
          '외부 인양에는 점검된 배수선과 배터리가 모두 필요합니다. 지금은 그 방법으로 두 함을 꺼낼 수 없습니다. D는 밀봉 인계입니다.':
            '외부 인양에는 점검된 배수선과 배터리가 모두 필요합니다. 지금은 그 방법으로 두 함을 꺼낼 수 없습니다. 두 함을 밀봉해 전문가에게 인계하는 방법은 남아 있습니다.',
          '보조 배터리 하나를 확인했습니다. C를 택하면 배터리와 제 전력을 모두 사용합니다. 두 함을 꺼낸 뒤 저는 잠듭니다.':
            '보조 배터리 하나를 확인했습니다. 두 함을 함께 꺼내려면 배터리와 제 전력을 모두 사용합니다. 두 함을 꺼낸 뒤 저는 잠듭니다.',
          '보조 배터리는 없습니다. C를 택하면 제 전력으로 배 한 척을 온전히 꺼낼 수 있습니다. 원본은 읽을 수 없게 됩니다.':
            '보조 배터리는 없습니다. 제 전력을 배에 집중하면 배 한 척을 온전히 꺼낼 수 있습니다. 원본은 읽을 수 없게 됩니다.',
          '우회 통로는 아직 사용할 수 있다고 확인하지 못했어요. D는 두 함을 밀봉해 남기는 방법이에요.':
            '우회 통로는 아직 사용할 수 있다고 확인하지 못했어요. 두 함을 밀봉해 남겨 둘 수는 있어요.',
          '박물관의 규약 변경을 공식 확인할 자료 조합이 아직 부족하다. 나래의 개인적인 뜻이 거짓이라는 의미는 아니다. A를 고르면 검증 예정 안내와 익명 전시를 남긴다.':
            '박물관의 규약 변경을 공식 확인할 자료 조합이 아직 부족하다. 나래의 개인적인 뜻이 거짓이라는 의미는 아니다. 지금 가진 자료로 정정을 진행하면 검증 예정 안내와 익명 전시를 남길 수 있다.',
          '남은 배터리로 모로를 켤 수 있어요. B를 택하면 그 배터리를 쓰고 로그를 추출합니다.':
            '남은 배터리로 모로를 켤 수 있어요. 추가 로그를 추출하려면 그 배터리를 써야 합니다.',
          '지금 모로를 켤 전원은 없어요. B를 택해도 이미 저장한 자료만 사용할 수 있습니다.':
            '지금 모로를 켤 전원은 없어요. 추가 로그를 확인하려 해도 이미 저장한 자료만 사용할 수 있습니다.',
          '손에 든 기록장에는 배와 원본의 상태가 남아 있다. 안내원을 고른다고 그 칸들이 온전함으로 바뀌지는 않는다.':
            '손에 든 기록장에는 배와 원본의 상태가 남아 있다. 여러분은 안내원의 이동과 배·원본의 후속 처리를 구분해 인계 내용을 확인한다.',
        }
      : {};
  const sceneMessages = content.messages.map((message) => {
    if (guidedVisit && sceneId === 'S01' && message.text.startsWith('마지막으로 보여 드릴 건'))
      return {
        ...message,
        text: message.text.replace('마지막으로 보여 드릴 건', '먼저 보여 드릴 건'),
      };
    if (guidedVisit && sceneId === 'F33' && message.text.startsWith('반환실 앞에 정비 수레가'))
      return {
        ...message,
        text: message.text.replace('반환실 앞에', '정비 통로의 마른 인계 지점에'),
      };
    if (
      guidedVisit &&
      sceneId === 'S31' &&
      message.text.startsWith('수령인과 주소가 접수 기록에')
    )
      return {
        ...message,
        text: '수령인과 주소가 접수 기록에 나란히 표시된다. 여러분은 나래에게 수령 정보를 확인했다는 답장을 보낸다.',
      };
    if (replacements[message.text]) return { ...message, text: replacements[message.text] };
    if (sceneId === 'P11' && message.text.startsWith('단말에는 가능한 순서 네 개가'))
      return {
        ...message,
        text: '단말에는 네 도장과 빈 칸이 놓여 있다. 도장을 직접 놓아 순서를 구성하고, 운송표의 네 조건과 대조한다.',
      };
    if (sceneId === 'P21' && message.text.startsWith('여러분은 네 순서를 비교한다.'))
      return {
        ...message,
        text: '네 작업을 예약 칸에 직접 놓는다. 아직 실행한 것은 아니다. 배치를 검토하고 팀의 예약을 제출한다.',
      };
    return message;
  });
  const hotspots = spec.groups.map(([id, label, anchor, , observation], index) => ({
    id,
    label: guidedVisit && sceneId === 'S01' && id === 'case' ? '제1호 진열장 살펴보기' : label,
    anchor,
    kind: ['moro', 'yunseo'].includes(anchor) ? 'talk' : 'inspect',
    requires:
      guidedVisit && ['S01', 'S31'].includes(sceneId) && index > 0
        ? [spec.groups[index - 1][0]]
        : spec.hotspotRequires?.[id] ?? [],
    messages: sceneMessages.slice(indices[index], indices[index + 1] ?? sceneMessages.length),
    observation,
  }));
  if (guidedVisit && sceneId === 'S22') {
    const rescue = hotspots.find((hotspot) => hotspot.id === 'rescue');
    rescue.label = '격벽과 배수·레일 조작반';
    rescue.anchor = 'valve';
    rescue.observation +=
      ' 안뜰과 같은 배수선·보조 레일을 반환실 측 공용 조작반에서도 점검할 수 있다.';
  }
  if (sceneId === 'D22' && flags.map)
    hotspots.at(-1).observation =
      '도면과 손잡이 번호를 대조할 수 있다. 실제 점검은 팀의 행동을 확정할 때 마친다.';
  const deduction = spec.deduction
    ? {
        prompt: spec.deduction.prompt,
        requires: spec.deduction.requires,
        options: spec.deduction.options.map(([id, label]) => ({ id, label })),
      }
    : null;
  return {
    objective: spec.objective,
    guidance:
      guidedVisit && sceneId === 'S01'
        ? {
            case: {
              objective: '윤서가 소개하는 제1호 전시품을 살펴보세요.',
              reason:
                '여러분은 마지막 야간 관람객입니다. 윤서가 박물관의 첫 전시품을 소개합니다.',
            },
            trail: {
              objective: '모로와 젖은 흔적을 살펴보세요.',
              reason: '제1호 종이배가 보이지 않습니다. 주변 흔적과 설명을 더 확인해야 합니다.',
            },
            schedule: {
              objective: '벽의 일정표에서 배가 필요한 날을 확인하세요.',
              reason: '윤서가 배를 찾아 달라고 부탁했습니다. 이 배가 언제 필요한지 확인합니다.',
            },
            ready: {
              objective: '흔적을 대조하고 배를 찾을 첫 조사 장소를 정하세요.',
              reason:
                '내일 아침 9시에 이웃들과 배를 띄울 약속이 있습니다. 어디서부터 조사할지 함께 정해야 합니다.',
            },
          }
        : spec.guidance ?? null,
    intro: sceneMessages.slice(0, indices[0]),
    hotspots,
    required:
      guidedVisit && sceneId === 'S01' ? ['case', 'trail', 'schedule'] : [...spec.required],
    deduction,
    puzzle: spec.puzzle ? structuredClone(puzzles[spec.puzzle]) : null,
  };
}

const failure = (code, message) => ({ ok: false, error: { code, message } });

/** Incorrect interpretations are recoverable feedback, not committed route choices. */
export function evaluateDeduction(sceneId, answerId) {
  const deduction = scenes[sceneId]?.deduction;
  if (!deduction || !deduction.options.some(([id]) => id === answerId))
    return failure('INVALID_DEDUCTION', '현재 추리판에 표시된 해석을 골라 주세요.');
  const correct = answerId === deduction.answer;
  return {
    ok: true,
    correct,
    feedback: correct ? deduction.success : deduction.retry,
  };
}

/** All 24 order permutations have a deterministic result; malformed boards never commit. */
export function evaluatePuzzle(sceneId, answer) {
  const puzzleId = scenes[sceneId]?.puzzle;
  if (!puzzleId)
    return failure(
      'NO_PUZZLE',
      '현재 장면에는 제출할 퍼즐이 없습니다. 조사 후 팀의 행동을 골라 주세요.'
    );
  if (
    !Array.isArray(answer) ||
    answer.length > 6 ||
    answer.some((id) => typeof id !== 'string' || id.length > 20)
  )
    return failure(
      'INVALID_PUZZLE',
      '배치는 6개 이하의 표시된 조각 또는 장소 ID로 보내 주세요.'
    );
  if (puzzleId === 'route') {
    const paths = [
      ['entrance', 'archive', 'return'],
      ['entrance', 'pump', 'return'],
      ['entrance', 'garden', 'return'],
      ['entrance', 'office', 'archive', 'return'],
    ];
    const index = paths.findIndex((path) => path.join(',') === answer.join(','));
    if (index < 0)
      return failure(
        'INCOMPLETE_PATH',
        '입구부터 반환실까지 지도에 있는 화살표 방향으로 경로를 완성해 주세요.'
      );
    const feedback = [
      '기록실 → 반환실은 침수된 운반 구간입니다. 네 구간이어도 장비가 통행할 수 없어 검증을 통과하지 못했습니다.',
      '펌프실을 거치는 다섯 구간이 통행 가능한 최단 운반로입니다. 검증을 마쳐 정비 자료함이 열렸습니다.',
      '안뜰의 운반로는 일곱 구간으로 통행할 수 있지만, 펌프실의 다섯 구간보다 깁니다. 최단 운반로 검증을 통과하지 못했습니다.',
      '관장실 쪽 운반로로 돌아가도 마지막 기록실 → 반환실 구간은 침수 상태입니다. 검증을 통과하지 못했습니다.',
    ][index];
    return {
      ok: true,
      choiceId: 'ABCD'[index],
      correct: index === 1,
      feedback,
    };
  }
  const pieces = puzzles[puzzleId].pieces.map(({ id }) => id);
  if (
    answer.length !== 4 ||
    new Set(answer).size !== 4 ||
    !answer.every((id) => pieces.includes(id))
  )
    return failure('INCOMPLETE_ORDER', '네 조각을 각각 한 번씩 빈 칸에 놓은 뒤 제출해 주세요.');
  const at = (id) => answer.indexOf(id);
  if (puzzleId === 'stamps') {
    const spacing = Math.abs(at('bell') - at('wave')) === 2;
    const adjacent = at('leaf') === at('bell') + 1;
    const afterWave = at('star') > at('wave');
    const afterLeaf = at('star') > at('leaf');
    if (spacing && adjacent && afterWave && afterLeaf)
      return {
        ok: true,
        choiceId: 'A',
        correct: true,
        feedback:
          '네 조건이 모두 맞습니다. 정비 자료함이 열리고 배수 통로 도면을 확보했습니다.',
      };
    const issues = [
      !spacing && '종과 물결 사이에 도장이 정확히 하나 있지 않습니다.',
      !adjacent && '잎이 종 바로 다음에 있지 않습니다.',
      !afterWave && '별이 물결보다 앞에 있습니다.',
      !afterLeaf && '별이 잎보다 앞에 있습니다.',
    ].filter(Boolean);
    // Preserve the authored B/C/D examples; additional permutations use the first failed rule family.
    const choiceId = !spacing || !adjacent ? 'D' : !afterWave ? 'C' : 'B';
    return {
      ok: true,
      choiceId,
      correct: false,
      feedback: `${issues.join(
        ' '
      )} 올바른 순서는 종 → 잎 → 물결 → 별입니다. 추가 도면 없이 직원용 수동 통로로 진행합니다.`,
    };
  }
  if (at('shut') > at('brace'))
    return {
      ok: true,
      choiceId: 'A',
      correct: false,
      feedback:
        '유입을 차단하기 전에 레일을 고정하도록 예약했습니다. 안전 장치가 실행을 막았습니다. 함은 움직이지 않았고 수동 복구로 진행합니다.',
    };
  if (at('power') < at('lift'))
    return {
      ok: true,
      choiceId: 'C',
      correct: false,
      feedback:
        '인양 전에 전원을 해제하도록 예약했습니다. 실행하면 인양할 수 없으므로 안전 장치가 막았습니다. 수동 복구로 진행합니다.',
    };
  if (at('brace') > at('lift'))
    return {
      ok: true,
      choiceId: 'D',
      correct: false,
      feedback:
        '레일 고정 전에 함을 인양하도록 예약했습니다. 안전 장치가 실행을 막았습니다. 함은 움직이지 않았고 수동 복구로 진행합니다.',
    };
  return {
    ok: true,
    choiceId: 'B',
    correct: true,
    feedback:
      '유입 차단 → 레일 고정 → 함 인양 → 전원 해제 순서를 승인했습니다. 아직 함을 움직이거나 전원을 쓰지 않았습니다. 이제 구조 대상과 전원을 정하세요.',
  };
}
