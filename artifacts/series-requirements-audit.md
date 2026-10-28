# 《돌아가는 길》 요구사항 검증 — 현재 판정

2026-10-29 최종 갱신. **실제 1~5편 동일 기록의 구현·조작·저장·시각·모션 검증과 최종 수락을 완료했다.** 로컬 `http://127.0.0.1:5188` 결과이며 외부 배포 완료를 뜻하지 않는다.

## 현재 확인 결과

- [실제 최종 실행 보고서](series-full-play/report.json): `errors=[]`, 박물관 E1 terminal/revision296·11선택 이후 연작 5편 complete/revision39, 방문 1~5, 결말 `강가의 빈자리`.
- [동일 기록 공식 검증](series-full-play/canonical-journey.json): `fixture=false`, 정상 Continue와 실제 렌더된 UI·바닥 클릭·WASD·E로 진행했다. 박물관 원본 296이벤트와 연작 39이벤트를 공식 `restoreGame`/`restoreSeries`로 복원했고 최종 브라우저의 flags/history/episodes와 일치하며 모든 필수 행동 완료를 확인했다. [박물관 원본](series-full-play/canonical-museum-record.json), [연작 원본](series-full-play/canonical-series-record.json). 이 계보 이외의 이전 프로필이나 E1 fixture를 여정에 합산하지 않았다.
- [1편 엔딩](series-full-play/museum-ending.png), [5편 엔딩](series-full-play/series-ending.png)을 root가 실제 검토했다. 1편 영상은 대표9프레임·4동작구간을 검토해 보행·몸체·카메라 전환·NPC 몸짓을 확인했다. [프레임](series-full-play/motion-contact.png), [동작 비교](series-full-play/motion-active-pairs.png). 영상 전체를 전수 검토한 것은 아니다. 후속편의 대표 영상과 전환도 아래 범위에서 최종 통과했다.
- 최신 스토리 연결 수정 후 전체 `npm test` **136/136**, `npm run build` **67파일** — 리드 실행 결과. [최신 스토리 연결 UI 검사](series-resume-qa/story-link-report.json)는 `errors=[]`이며 로드한 모듈 지문과 실제 콘텐츠·상태·view를 확인했다. 관련 집중 검사15개도 통과했다. 앞선 전편 실행에는 당시 캐시된 텍스트가 포함됐으므로 전 과정이 단일 최종 빌드였다고 주장하지 않는다. 후속 텍스트 변경을 별도 최신 검사로 검증했다.
- [공간 음향 QA](series-resume-qa/spatial-report.json) `errors=[]`: 종이·목재·금속 이벤트, 박자, 거리 변화·카메라 회전 pan 반전, 숨김·대화 중 환경음 억제 확인. [음향 검토](series-audio-review.md). 실제 노드·이벤트 검증이며 스피커/헤드폰 청취·합산 음량 측정은 아니다.
- [저장·재개 경계 QA](series-resume-qa/REPORT.md), [원자료](series-resume-qa/report.json) `errors=[]`: 행동 중 새로고침·숨김 취소·캡션 재시도 1회 커밋·완료경계/왕복 좌표 복원, 준비충족 C와 부족 C의 제한규모 UI 확인. fixture 검사는 실제 전편 기록과 분리했다.
- 모델: 후속편43카탈로그 항목(공용 배우 중복), 24방향1,032뷰·대표 배율36장, 전 항목4방향172뷰 contact 및 추가 배율2장 실제 검토. 1,032뷰 전부 개별 육안 검토·43개 고유 신규 모델·전체 카탈로그 게임 승인으로 확대하지 않는다. 편별 `review/review.md`와 manifest의 승인 `modelled`를 유지한다.
- 최종 원고·runtime·자산 SHA-256은 `assets/episodes/ep-02..05/manifest.json`에 현재 파일로 갱신했다. 소스 지문과 실제 실행의 로드 시점은 구분한다.

## 최종 대표 화면·모션·전환 판정

root는 후속편 실제 영상 `artifacts/series-full-play/motion/page@d4198f32630b6b0480d304b2169fca2a.webm`(360.72초)의 네 공간을 포함한 대표9시점과 4개 동작 구간(각0/0.2/0.4초)을 실제 검토했다. [장면 표본](series-full-play/series-motion-contact.png), [동작 비교](series-full-play/series-motion-active-pairs.png), [추출 기록](series-full-play/series-motion-review.json). 검토한 범위에서 보행·왼쪽 동행 대형·NPC 몸짓·소품과 UI 순서를 확인했고 뚜렷한 관통을 발견하지 않았다.

[전환 표본](series-full-play/series-transition-contact.png)의69~74.6초 구간에서 출발 카메라→전체 가림→새 장면 공개→도입 순서를 확인했고 빈 화면이나 오류 프레임을 발견하지 않았다. 1편 대표9프레임·4개 동작 구간 및 1·5편 엔딩 화면 검토와 함께 원래 목표의 시각·모션 수락 근거로 사용한다. 영상 전체 전수 검토나 실제 하드웨어 성능 측정으로 확대하지 않는다. 최종 감사도 추가 필수 구현 작업이 없다는 데 동의했다.

## 완료 상태

원래 요청의 필수 구현·검증 작업을 마쳤다. 편별 자산 카탈로그의 관리 승인 `modelled`는 개별 모델 전체 상태·모션의 별도 승인 단계이며 완료한 게임 대표 경로의 수락을 보류하는 항목이 아니다. 외부 배포는 수행하지 않았다.

## 과거 기록 해석

아래의 ‘진행 중·초안·최초 report 실패·133/134검사·미판정 NPC·갤러리 미완료’는 작성 당시 스냅샷이며 현재 상태는 위 최종 갱신을 따른다. 현재 `series-full-play/report.json`은 성공 보고서로 교체됐고 최초 도구 실패 이력은 `driver-failure-before-resume.json`, `museum-complete-boundary-driver.json` 등으로 구분한다. P21/R31 미독 대상 가림·NPC 리셋 겹침·초기 수입 복구 등 확인된 제품 결함은 수정 후 실제 진행 또는 집중 회귀를 검증했다. 비동기 `null.view` 대기 오류는 검사 도구 오류로 수정했다. 역사 기록의 실패를 삭제하거나 최신 성공과 합산하지 않는다.

---

# 이전 단계 기록 — 아래 시점의 상태를 보존

# 《돌아가는 길》 요구사항 감사

기준일: 2026-10-29. 범위는 원래 사용자 요청(1편 보존, 대화만이 아닌 실제 5편 게임, 음향·충돌·NPC 이동 AI·카메라·입력·목표·상태, 의미 있는 공간 전환, 실제 1~5편 조작과 경계 저장·재개, 화면·동작의 시각 일관성) 및 `artifacts/game-progress.md`의 구현 기준이다. 문서·현재 소스·기존 검증 기록을 대조했다. 이 감사에서는 빌드, GPU 렌더, 브라우저 플레이를 실행하지 않았다. 아래 ‘구현’은 소스 존재와 연결을 뜻하며 실제 플레이 승인을 대신하지 않는다.

## 판정

**전체 목표는 아직 검증 진행 중이다.** 1편 보존과 후속편 상태·원고·월드·전환·오디오 연결이 구현돼 있다. E1 fixture에서 2~4편을 실제 입력으로 진행한 뒤, 저장된 4편 출발 상태를 복원해 5편의 8개 현장 행동과 결말까지 도달했다. 실제 1편은 E1 terminal/revision296까지 완료했고 같은 기록으로 후속편을 진행 중이다. 후속편 전체 모델 렌더와 전 항목 4방향 contact sheet 검토는 완료했으며, 게임 장면·모션과 저장·조건별 통합 검수의 최종 승인은 남아 있다.

## 기준별 증거와 남은 검증

| 명시 기준 | 구현 및 확인 가능한 증거 | 현재 판정과 남은 일 |
| --- | --- | --- |
| 박물관 전체 3장을 1편으로 보존 | `src/playbook.mjs`, `docs/manuscript/`, `public/app.mjs`; 박물관 종료 상태를 연작에 전달하는 연결 | 소스 연결 확인. 실제 1편 E1 terminal/revision296·주요 선택11건 원자료 확인. 같은 실제 기록의 후속편 검사는 진행 중 |
| 실제로 연결된 총 5편 | `public/app.mjs` → `public/series-game.mjs`; `src/series-content.mjs`; `public/series-world.mjs` | 2~5편 구현. 실제 입력 2~4편 후 4편 출발 저장을 복원하여 5편 complete/revision39에 도달. `series-integration-qa/resumed-complete.json`. 실제 1편부터의 연속 완료 미확인 |
| 이동→근접 조사·대화→근거 판단→작업 배분→현장 실행 | `series-game.mjs`, `series-world.mjs`, `series-action-plan.mjs`; `tests/series-action-plan.test.mjs` | 장소별 행동·소품 투영 연결. 실제 입력으로 2~4편을 진행했고 5편 8개 현장 행동·귀환을 완료했다. 4편 NPC 재배치 동결은 실제 결함으로 확인·수정 후 저장 경계부터 재개했다. 전체 조건의 장면·모션 승인은 별도 |
| 중간 세 편의 여섯 방문 순서 | `tests/series-state.test.mjs`의 384조합·6순서 검사와 canonical 원고 경로 검사 | 상태 규칙 검증과 실제 이동은 구분. 여섯 순서는 엔진 조합 검사로 검증한다. 실제 대표 순서의 전편 조작과 조건별 UI·전환·저장 검증을 추가해야 함. 여섯 순서 모두의 브라우저 완주는 별도 필수 기준으로 추가하지 않음 |
| v2 준비 상태·최종 규모 제한 | `src/series-state.mjs`; 오답/동의/장비 검증 구분, 보완 하나가 여러 결손을 지우지 않는 검사 | 규칙 구현. 준비 부족·충족, 보완 제한과 각 규모의 실제 최종 연출을 브라우저에서 확인해야 함 |
| 원고 충실도 | `src/series-content.mjs`; `tests/series-content.test.mjs`; `artifacts/series-story-audit.md` | 분기별 참석·물품·회신 조건 검사 존재. 실제 대사 표시와 행동 시점의 전편 검토는 남음 |
| 이전 편 선택의 소유·인계·보관 일치 | `public/series-action-plan.mjs`; 미검증 표지·운반대 투영 회귀 검사; `series-audio-review.md`의 정합성 후속 검토 | 소스에서 정연 참석과 장비 검증 조건 수정 확인. 모든 조합의 실제 화면·보관·귀환 동작 미승인 |
| 실제 공간 관찰과 이동·NPC 이동 AI·충돌 | `public/series-world.mjs`; `series-world-smoke/`; 부분 키보드/E 조작 기록 | 월드 스냅샷이 통행·접근성 승인 증거는 아님. 4편의 NPC 원위치 재배치로 플레이어가 겹쳐 움직이지 못하는 결함을 확인했다. 소스 수정과 독립 수치 재검토 5사례를 리드가 보고했고 저장 경계 복원 후 5편 완료. 광범위 접근성·배치 검수는 별도 |
| 카메라·음향·입력 잠금·저장 커밋의 전환 수명 통합 | `public/series-transition.mjs`; 대기·가림 후 1회 커밋·취소·실패 재시도 검사; dawn/walk/curtain/door 스타일 | 상태 계약 확인. 최신 전편 전환의 실제 시점·조작 잠금·오디오 연속성은 통합 검수 대기 |
| 박물관 원본과 연작 저장 보존·재개 | `return-path-series-v2:<sessionId>`; `src/series-state.mjs` 이벤트 재생; `series-integration-qa/save-recovery.json` | 손상 자동 저장→파일 수입 복구와 실제 4편 출발 저장→5편 완료 증거 존재. `series-resume-qa/REPORT.md`에서 새로고침·숨김 취소·캡션 재시도 1회 커밋·왕복 좌표 복원·준비충족 C 및 부족 C→제한규모 UI 통과. 실제 1편부터의 전체 기록 완료만 별도 진행 중 |
| 전체 모델과 게임 시각 검수 | 편별 `manifest.json`, `/asset-gallery.html?episode=1..5`, `tests/series-assets.test.mjs` | 기하·bounds·parts·collider 검사는 시각 승인과 별개. 2~5편 43카탈로그 항목·1,032뷰와 대표 배율 36장 캡처 완료, 전 항목 4방향 172뷰 contact sheet 검토. 전 시점 개별 육안 검토·게임 배치·모션은 미완료 |
| 음향 구현과 실제 품질 | `public/audio.mjs`; `artifacts/series-audio-review.md` | 실제 Chromium WebAudio 노드로 음소거·덕킹·24음 제한·루프 해제 검사. 물리 출력 청취, 합산 음량, OS 배경 동작과 전편 통합 품질은 미검증 |

## 자료 해석 규칙

- 리드가 보고한 최신 실행은 회귀 **134/134**, 빌드 **67개 파일**이다. 이 감사에서 재실행하지 않았다. 테스트 수는 기능·실제 플레이의 완료율이 아니다.
- `series-integration-qa/REPORT.md`와 `continuation-audit.md`는 실행 당시의 제한된 범위를 증명한다. 이후 현장 행동·조건부 투영·전환·음향 수정의 전체 검증 증거로 사용하지 않는다.
- `series-world-smoke`는 월드 생성·스냅샷 증거다. 임의 상태 주입이나 E1 fixture는 실제 1편 시작부터의 플레이와 구분한다.
- 갤러리 전체 모델은 아래 보고서에서 생성 수를 확인했다. 이미지 생성과 실제 육안 검토는 다른 단계다. 카탈로그 모델과 게임에 배치한 모델도 동일 집합이라고 가정하지 않는다.
- `assets/episodes/ep-02..05/manifest.json`의 승인은 `modelled`로 유지한다. 런타임 경로·공용 배우 모듈·원고 및 구현 SHA-256은 현재 파일로 채웠다. 해시는 대조 기준이며 후속 변경이나 시각 승인을 자동 보장하지 않는다.
- `artifacts/series-assets-audit.md`의 “ep01 생성기만 존재” 등은 최초 실사 당시 기준이다. 현재 상태는 편별 manifest·README와 이 감사 및 진행 기록을 함께 확인한다.

## 완료 판정에 필요한 증거

1. 최신 빌드에서 실제 1편 전체→후속편→5편 실행·귀환을 끝낸 입력·상태 기록과 화면.
2. 중간편 여섯 순서의 엔진 조합 검사와 준비 상태·규모·보완 제한의 주요 조건별 UI 검증. 대표 실제 1~5편 경로와 조합 검사를 분리 기록.
3. 새로고침·파일 복원·손상 수입·편 전환·숨김 및 행동 취소의 재개 정합성.
4. 기존 1편 검수 이력과 후속편 24방향·대표 3배율 캡처를 대조하고 필요한 추가 이미지·모션을 검토한다. 장면 배치·문자 가독성·NPC·소품 충돌·카메라는 별도 확인.
5. 원고 조건·인물 참석·장비 보관과 귀환, 오디오 청취·음량 및 전환을 통합 검토하고 발견 이슈를 해결한 기록.

각 항목이 충족될 때만 승인 단계를 올린다. full1 진행 상태나 새 테스트 결과는 해당 담당자의 실제 산출물이 도착한 뒤 갱신한다.

## 후속편 갤러리 렌더·시각 검토 갱신

report JSON에서 각 항목의 yaw 8방향×pitch 3방향과 이미지 파일 존재, 오류 빈 배열을 대조했다. 렌더 실행 및 실제 이미지 검토는 root 담당자가 수행했다.

| 편 | 갤러리 항목 | 24방향 렌더 | 대표 배율 | 실제 검토 범위·증거 |
| --- | ---: | ---: | ---: | --- |
| 2 | 11 | 264 | 9장 | 전체 항목 4방향 44뷰 [contact](series-assets/ep-02/contact.png), [report](series-assets/ep-02/report.json) |
| 3 | 10 | 240 | 9장 | 전체 항목 4방향 40뷰 [contact](series-assets/ep-03/contact.png), [report](series-assets/ep-03/report.json) |
| 4 | 9 | 216 | 9장 | 전체 항목 4방향 36뷰 [contact](series-assets/ep-04/contact.png), [report](series-assets/ep-04/report.json); 안내등 1.8배 별도 검토 |
| 5 | 13 | 312 | 9장 | 전체 항목 4방향 52뷰 [contact](series-assets/ep-05/contact.png), [report](series-assets/ep-05/report.json); 쉼터 0.6배 별도 검토 |

합계는 43카탈로그 항목·1,032뷰·대표 배율 36장이다. 공용 배우가 편별로 중복되므로 43개 고유 신규 모델이라는 뜻은 아니다. 172뷰를 담은 contact sheet와 배율 2장을 검토한 범위에서 형상 구멍·받침 누락·스타일 불일치를 발견하지 않았다. 안내등 1.8배 화면 잘림은 의도한 줌 크롭으로 판단했다. 자동 렌더한 1,032뷰 전부를 개별 육안 검토한 것은 아니다. 방 배치·모션은 이 gallery-only 결과로 승인하지 않으며 편별 `review/review.md`와 manifest 승인 `modelled`를 유지한다.

## 실제 입력 후 저장 경계 복원 검증 갱신

- 리드는 E1 fixture에서 2→3→4편을 실제 키보드·클릭으로 진행했다. 실제 1편 시작은 이 경로에 포함하지 않는다.
- 4편의 배우 재배치가 플레이어와 겹쳐 출발을 막는 P1 결함을 확인했다. 이를 단순 자동 경로 문제로 분류했던 이전 설명은 이 결과로 대체한다. 리드는 수정 소스와 독립 수치 검토 5사례를 확인했다.
- 이후 실제 캡처한 4편 `departure/revision25` 저장을 복원해 5편의 8개 현장 행동을 모두 완료했다. [상태 기록](series-integration-qa/resumed-complete.json)의 최종 상태는 `episodeId=5`, `stage=complete`, `revision=39`, 결말 `강가의 빈자리`, `errors=[]`다. [완료 화면](series-integration-qa/resumed-complete.png).
- 실제 1편부터의 full1 검사는 별도 진행 중이다. 이 결과를 박물관 3장 전체 조작 완료 증거로 사용하지 않는다. 최신 저장/취소/캡션과 준비 완료 5C·제한규모 fixture 검토는 `series-resume-qa/REPORT.md` 및 `report.json`의 errors=[]로 통과를 확인했다.
- 마지막 전체 회귀 134/134는 최신 공간 음향 수정 이전 리드 실행 결과이며 최종 전체 재검사 결과는 대기다. 최신 공간 음향 반영 빌드는 67파일로 리드가 보고했다. 이 문서 작업에서는 테스트·빌드·브라우저를 재실행하지 않았다. 편별 manifest의 원고·소스 SHA-256은 이번 갱신 시점의 현재 파일로 다시 기록했다.

현재 최종 증거는 [final-evidence.md](final-evidence.md)의 초안에 모았다. [최종 수락 감사](series-final-audit.md)에서 이미 수락한 경계 QA를 미완료 필수 항목으로 다시 추가하지 않는다.

## 실제 1편 완료와 동일 기록 후속편 진행 갱신

실제 초대장부터 진행한 동일 `4e553` 브라우저 기록이 박물관 E1에 도달했다. [박물관 완료 경계 원자료](series-full-play/museum-complete-boundary-driver.json)의 최종 `view`는 `sceneId=E1`, `phase=terminal`, `revision=296`, 주요 선택 이력 11건이다. [박물관 엔딩 화면](series-full-play/museum-ending.png). 이는 E1 fixture 주입과 구분되는 실제 1편 완료 증거다.

위 원자료의 `errors`에는 후속 연작 마운트 전 `null.view`를 읽은 검사 도구 오류가 남아 있다. 따라서 이 파일 전체를 errors=[] 성공 보고서라고 표기하지 않는다. 리드는 비동기 경계 대기식을 수정한 뒤 같은 브라우저·동일 기록의 정상 Continue와 dawn 전환으로 2편에 진입했고, 이번 문서 갱신 시점에는 `perform/revision5`까지 진행했다고 보고했다. 저장/상태 주입 없이 박물관 296개 이벤트 계보를 유지한 경로이며, 5편까지의 새 성공 보고서는 아직 대기다.

리드는 실제 1편 영상에서 대표 9프레임 및 4개 동작 구간을 검토했다. [대표 프레임](series-full-play/motion-contact.png), [활성 동작 비교](series-full-play/motion-active-pairs.png). 검토 범위에서 다리·몸체 이동, 문 주변 카메라 전환, NPC 몸짓을 확인했고 뚜렷한 화면 관통을 발견하지 않았다. 770.2초·약86MB 원본 영상 전체를 빠짐없이 검토했다는 뜻은 아니다. 같은 기록의 후속편 포함 최종 영상은 완료 후 별도로 확정한다.

최신 실제 R31에서 미독 대사를 우선 읽도록 조사 선택을 수정했고, 관련 8사례 소스 검토 결과는 리드가 확인했다. 최종 전체 `npm test` 결과는 아직 대기다. 편별 manifest 런타임 소스 SHA-256은 이번 문서 갱신 시점에 다시 일치시켰다.
