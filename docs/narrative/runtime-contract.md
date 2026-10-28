# 전체 게임 연결 계약

맵 이동, 사물 조사, 추리와 퍼즐 제출, A–D 결정을 사건으로 기록한다. 같은 기록을 재생하면 같은 장면과 결말을 얻는다. 새 버전은 `museum-map-4`이며 이전 지도판·조사판·읽기판 저장도 각 버전의 규칙으로 재현한다.

## 선택한 구성

브라우저 표준 모듈로 전체 게임을 실행하고 상태는 브라우저 세션이 소유한다. 화면은 `publicView`가 선택한 메시지와 가능한 행동을 표시한다. 기존 T22의 대화 자료·추궁 규칙을 재사용한다. 옛 12장면 초안은 실행 경로에 넣지 않는다. React 등 새 UI 의존성을 추가할 필요는 없으며 Three.js만 공간 연출에 사용한다.

브라우저는 모듈 초기화 때 세 챕터와 엔딩 원고를 정적 파일로 한 번 불러온다. Node에서는 같은 원고를 파일로 읽으며 두 환경이 같은 파서를 사용한다. 초기화 후 게임 API는 동기식으로 유지한다. 조건 선택은 명시적인 함수로 처리한다. 모든 Markdown 조건을 추측하는 범용 해석기를 만들지 않는다. 원고의 대사를 재작성한 별도 복사본 대신 문단을 골라 읽어 조건·삽입 지시문을 제거한다.

## 콘텐츠 경계

`src/content/chapters-12.mjs`와 `src/content/chapter-3.mjs`는 아래 함수를 export한다. 브라우저와 Node에서 실행하며 원고 경로는 `import.meta.url` 기준으로 정한다.

- `sceneContent(sceneId, flags, history)` → 해당 범위를 소유하면 `{id, title, chapter, messages, choices, hints, npc}`; 아니면 `null`.
- `resultContent(sceneId, choiceId, before, after, history)` → 선택 결과 메시지 배열; 소유하지 않으면 `null`.
- 3장 모듈의 `endingContent(endingId, flags, history)` → `{id,title,chapter:3,messages,choices:[],hints:[],npc:null}`.
- `messages` 원소는 `{speaker, text, facts?: string[], claimId?: string|null}`. 제작자용 조건·상태·다음·삽입은 메시지가 아니다.
- `choices`는 정확히 A–D 순서의 `{id,label,detail}`. `detail`은 클릭 전 현재 조건과 대가 안내다. 미래 정답을 알려 주지는 않는다.
- `hints`는 문자열 배열. 사용해도 상태·엔딩이 변하지 않는다.
- `npc`는 대화 장면 T21=`moro`, T22=`yunseo`, S31=`nara`, 그 외 `null`.
- `flags`는 charter/log/statement/request/battery/map/maintenance/repair(boolean), boat(locked/intact/damaged/sealed), record(locked/intact/unreadable/sealed), moro(active/asleep), crane(null/stable/stalled), lead(null/robot/archive/garden/curator), stance(null/listen/verify/ask/confront), intent(null/return/exhibit/moro/open), method(null 또는 명세 값).
- `history`는 확정 선택의 `{sceneId,choiceId,before,after,nextSceneId}` 배열. 엔딩의 ‘선택 전’은 마지막 항목의 before를 참조한다.
- 본문은 모든 대사와 조건별 문학적 연결을 유지한다. 대량 축약하지 않는다. 잠든 모로 대사·없는 자료·중복 물건이 생기지 않게 한다.

## 상태머신 경계

`src/playbook.mjs`가 실제 플레이의 유일한 진입점이다. `createGame(teamId)` / `dispatch(state,event)` / `publicView(state)` / `saveGame(state)` / `restoreGame(record)`를 제공한다. 결과는 `{ok:true,state,effects:[]}` 또는 `{ok:false,error:{code,message}}`이다. `publicView`만 화면에 보낸다.

새 지도판은 O00 로비에서 시작한다. 첫 한 문장은 역할·목표 카드로 보여주고 즉시 `exploring`이 된다. `invitation`을 끝까지 읽으면 `curator`가 공개된다. 두 관찰을 마친 뒤 `CONTINUE`하면 윤서와 제1 전시실로 실제 이동한다. O00는 고정 대화만 사용하며 자유 질문, A–D 선택, 자원 획득과 주요 결정 기록은 없다. 이후 S01의 `case` → `trail` → `schedule`을 순서대로 확인해야 실종, 윤서의 부탁, 내일 9시 약속을 모두 알고 첫 분기를 고를 수 있다. S01의 첫 진열장 관찰 전에는 제목·목표·조사 이름에 실종 사실을 표시하지 않는다.

`museum-map-4`의 S01 첫 선택 결과는 조사 의도와 목적지 한 문장만 공개한다. A–D의 원래 결과 대사는 직전 선택 이력의 `before`·`after`에서 계산해 목적지 도입 앞에 보존하고, `ARRIVE` 이후에만 읽는다. 도착 전에는 기록실 서류나 안뜰의 물길을 이미 확인했다고 말하지 않는다. 이 배치는 주요 결정·자원·관찰 완료 여부를 추가하지 않으며 이전 버전의 공개 순서는 그대로다.

같은 지도판에서 D22-B/D와 S31-C의 결과는 현재 장소에서 마친 행동과 다음 장소로 갈 의도를 구분한다. S31-C는 선택하지 않은 첫 조사 경로를 회상하지 않는다. F33 도입의 수레는 실제 목적지인 정비 통로에 놓인다. S31 대화는 `report` → `promise` → `consent` 순서로 끝까지 읽어야 다음 블록이 열린다. 이전 지도판과 이야기판의 원고·조사 순서는 바꾸지 않는다.

S31 수령 정보 확인은 나래에게 확인 답장을 보내는 경험으로 서술한다. 모든 경로에서 정보를 얻는다는 구현 설명은 플레이 대사에 넣지 않는다.

R31·R32·F32의 조건 대사는 선택지 문자 대신 실제 구조·정정 방법을 말한다. F33은 안내원과 물건의 인계를 구분하며 상태 칸의 변경 규칙을 설명하지 않는다. 엔딩 공통 후일담은 모로의 실제 최종 작동 상태와 인계 사실만 남기고, 가능한 여러 전원 경로를 가정해 나열하지 않는다. 이 문구 정리도 새 지도판에만 적용하며 P21의 게임 안내는 유지한다.

P12 결과의 다음 이동도 출발 의도로 표시한다. S22의 `rescue` 관찰은 반환실 측 공용 조작반을 가리키며, 안뜰과 같은 배수선·보조 레일을 이 위치에서도 점검할 수 있음을 알린다. C는 그 조작반에서 준비하는 행동이다. 도면이 없으면 위치 확인과 도면 확보만 하고, 도면이 있으면 점검·개방을 마치며, 이미 준비됐다면 재확인한다. 새로운 설비·전원·통로·상태는 추가하지 않고 실제 인양은 이후 구조 결정에 남긴다. 이 설명과 조사 앵커 변경도 `museum-map-4`에만 적용한다.

`createGame`의 선택 인수 `{mode,storyVersion}`에서 버전은 복원할 때 원래 규칙을 고르는 용도다. 새 게임은 버전을 생략한다. `museum-map-3`은 기존 S01 시작과 필수 관찰 하나를 유지하고, `museum-play-2`와 `museum-full-1`도 O00를 거치지 않는다. 잘못된 모드·버전 조합은 거부한다. 저장 형식 버전은 1을 유지한다.

- 상태는 불변이며 시간·랜덤·I/O를 읽지 않는다. teamId는 1~3. 각 팀의 진행·질문·저장은 독립이다.
- 사건의 공통 envelope는 `{type,teamId,sceneId,revision}`. state.revision은 모든 반영 사건마다 증가한다. 다른 팀·오래된 revision은 거부하고 상태를 보존한다.
- `NEXT`: 현재 조사·대화 블록의 다음 메시지를 공개. 끝나면 `input`(대화 가능 장면) 또는 `exploring`. 조사 블록의 마지막 메시지를 공개하면 관찰 기록을 한 번 추가한다.
- `INSPECT` + `hotspotId`: 현재 장면 물체의 원고 블록을 읽는다. `EXPLORE`: 남은 블록을 중단하고 현장으로 돌아간다. 미완료 조사는 완료 관찰로 기록하지 않는다.
- 지도판의 S22는 `story`(원래 기록) → `request`(반환 요청·윤서의 인정) → `rescue`(구조 준비) 순서다. 직전 블록의 마지막 메시지를 읽어 관찰을 완료해야 다음 물체가 공개된다. 잠긴 ID를 직접 보내도 `HOTSPOT_LOCKED`로 거절한다. 다른 장면의 자유 조사와 이전 `museum-play-2`의 조사 순서는 유지한다.
- `DEDUCE` + `answerId`: 필요한 관찰을 마친 뒤 해석을 대조한다. 잘못된 해석은 수정할 수 있으며 자원이나 경로를 바꾸지 않는다. `SOLVE` + `answer`: 완성된 배열/경로를 판정하고 결과 분기를 확정한다. 잘못된 형식·중복 조각·미완료 경로는 거절하고 배치를 유지한다.
- `OPEN_CHOICES`·`CHOOSE`: 필수 관찰과 추리가 끝났을 때만 주요 행동을 열고 확정한다. 퍼즐 장면에서는 직접 `CHOOSE`를 보낼 수 없다. `BACK`은 현장으로 돌아간다.
- `CONTINUE`: 결과를 모두 읽은 뒤 목적지를 준비한다. 다른 방이면 `travelling`이 되어 새 대사·단서·질문을 공개하지 않는다. `ARRIVE` + `roomId`가 목적지와 일치하면 도입을 시작한다. 같은 방 장면은 바로 읽으며 엔딩은 마지막 방에서 읽은 후 `terminal`이 된다.
- O00의 `CONTINUE`는 두 관찰을 끝까지 완료했을 때만 허용한다. `SKIP_INTRO`는 O00 또는 첫 제1 전시실 이동에서만 허용하며, S01 도입으로 이동할 뿐 S01 관찰·추리·자원을 지급하거나 주요 결정을 추가하지 않는다. 메뉴에서 나가는 일은 세션을 보존하며, `EXPLORE`로 읽기를 중단하면 미완료 관찰은 계속 잠겨 있다. 재개 시 같은 메시지와 관찰을 복원하고 보행 위치는 현재 방의 시작점으로 복원한다.
- `HINT`: 현재 퍼즐의 다음 힌트를 공개. `TOPIC` + `topicId`: 준비된 질문과 단서 추궁 답변을 공개한다.
- 공개 `dispatch`는 `ASK`, `AI_RESOLVE`, `AI_FAIL`, `CANCEL`을 `AI_DISABLED`로 거부하고 상태를 보존한다. 외부 AI 호출은 없으며 화면에 AI 대기 상태나 사용 횟수를 제공하지 않는다.
- 이전 저장에 포함된 AI 사건은 복원 내부에서만 검증·재생한다. 당시 공개된 대사와 결정은 보존한다. AI 응답을 기다리던 저장은 취소 사건을 기록에 추가해 `input`으로 복원하며 효과를 실행하지 않는다. 다시 저장해도 같은 상태로 재생할 수 있다.
- T22의 준비된 증거 질문을 기존 추궁 규칙에 매핑한다. 대화로 서명·물건·실행을 자동 획득하지 않는다. 사실 인정과 자원 획득은 구분한다. I04 수신 인정은 이어진다.
- 엔딩 이후 진행/질문은 거부. 새 게임은 별도 생성 작업이다. 읽는 시간은 자원에 영향을 주지 않는다.

저장은 버전이 있는 사건 기록이다. 가져온 완성 상태를 믿지 않고 사건을 검증·재생한다. 저장 파일은 SHA-256 무결성 값과 함께 감싸되 이것을 인증으로 간주하지 않는다. 브라우저의 동기식 SHA-256은 기존 Node 저장과 같은 UTF-8 입력·체크섬 형식을 사용한다. 저장 형식 버전과 이야기 버전은 유지하며 유한 크기와 사건 수를 제한한다.

`publicView`의 `exploration`에는 공개 가능한 물체 이름, 완료한 관찰, 진행 가능 여부만 포함한다. 필수 조사 전에는 퍼즐 규칙·지도, 추리 전제 문장을 표시하지 않는다. 누적 `observations`는 장면 이동 후에도 읽을 수 있다. 전체 원고는 브라우저가 불러오는 정적 자료이므로 미공개 본문을 비밀로 보호하는 구조는 아니다. 위치와 보행 충돌은 화면이, 이야기의 방 도착 전이는 상태머신이 관리한다. 자세한 소유 범위는 [지도 게임 계약](map-gameplay.md)을 따른다.

공통 안내는 `exploration.objective`, `reason`(작성된 이유가 없으면 null), `recommendedHotspotId`, `primaryAction:{kind,label,hotspotId?}`로 보낸다. `kind`는 UI 안내용 `inspect`, `deduce`, `puzzle`, `choices`, `continue`이며 상태머신 사건 이름이 아니다. 아직 완료하지 않은 공개 필수 조사부터 추천하고, 이후 추리·퍼즐·결정으로 이어진다. O00 완료 시에는 `continue`를 추천한다. `canSkipIntro`는 도입 건너뛰기의 허용 여부다. `nextScene`은 목적 장면과 `roomId`, `roomLabel`, 작성된 이동 `reason`을 포함하며, 첫 이동의 `travel.companion`은 `yunseo`다.

P12의 퍼즐은 침수 구역 안쪽의 **시설 운반로 검증**이다. 아바타가 걷는 관람 복도 지도와 구분한다. 검증 성공으로 정비 자료함의 도면을 확보하며, 성공 여부와 관계없이 사람은 관람 복도로 반환실 앞에 합류한다. 조사판·지도판의 도입·조사 대사는 `investigationFor`에서 원문 메시지를 교체하고, 퍼즐 결과는 판정과 실제 도면 보유 상태에 맞춰 구성한다. 원고 Markdown과 이전 읽기판의 본문·A–D 결과는 보존한다.

## 단계 검증

게임 연결에서 기존 Python 명세 모델과 선택 결과를 대조하고 실제 브라우저로 한 경로를 읽는다. 화면·연출 단계에서 현장 대화와 단서 추궁·저장 복원·모바일 레이아웃을 실행한다. 마지막 리허설은 84개 선택·89개 목적지 분기와 자원별 결과·6엔딩을 실행 목록으로 남긴다. 같은 검사를 파일마다 반복하지 않는다.
