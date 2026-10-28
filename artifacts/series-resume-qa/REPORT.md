# 저장·재개 경계 QA

최신 5188 정적 서비스에 격리 Chromium(640×480)을 연결했다. 저장 주입은 명시적인 테스트 fixture이며, 실제 1~5편 전체 플레이나 여섯 방문 순서의 증거가 아니다. 첫 동작 fixture는 리드의 실제 2~4편 입력 후 이어진 기록 중 5편 revision 31을 사용했다. 준비 완료 C·부족 C·왕복 저장 지점은 규칙 엔진으로 생성한 fixture다.

## 통과

- 실제 캡션 버튼으로 행동을 시작하고 완료 전 새로고침: revision 31, 선택, 미완료 행동 유지.
- 행동 도중 숨김: 커밋 취소, 대기 후에도 revision 유지. 복귀 후 실제 캡션 버튼 재시도: meet-yeonwoo 한 번만 커밋해 revision 32.
- 행동 경계 새로고침: revision 32와 완료 행동 유지.
- 이동등·길·신호 준비가 충족된 C 선택 UI: 세 접점 실행 C 유지.
- 준비가 부족한 C 선택 UI: 실제 작은 시험 D/한자리 A 안내 노출, D 선택 반영.
- canonical outward-walk 완료 fixture 새로고침: 선택·완료 목록과 플레이어 (0,-4), revision 35 일치.
- 별도 실제 audio 모듈 검사: QA 버튼의 사용자 클릭으로 running, master 0에서 실제 GainNode 0, 80 복원에서 약 .64. 앱 설정 UI 자체의 종단 검사는 아니다.

최종 경계 검사 report.json의 errors는 비어 있다. 최초 검사 시 대기식 undefined!==null로 mount 완료를 너무 일찍 판정한 harness 오류가 있었으며 Boolean(view)로 수정 후 위 검사를 통과했다. 제품 결함으로 분류하지 않는다. module-hashes.json은 검사 직후 dist 파일 지문이며 네트워크 응답별 로드 시점의 증명은 아니다.

## 실제 1편 검사 스크립트 소스 검토

`scripts/check-series-full-play.mjs`, `scripts/investigation-browser-driver.js` 문법 검사 통과. 상태/이벤트를 주입하지 않고 저장은 reader로 읽는다. 상태 전이는 렌더된 DOM 컨트롤 또는 실제 키보드·바닥 조작 경로를 사용한다. 브라우저 드라이버의 DOM click은 UI 핸들러를 실행한다. 최종 complete assert와 errors assert, catch 재던지기가 있어 중간 실패를 성공으로 끝내지 않는다.

증거 주의점 두 가지:

- 시작 때 계산한 buildHash는 app·museum-scene·series-game 세 파일만 포함한다. 런타임 중 늦게 로드되는 series-world/action-plan/audio와 중간 재빌드를 포괄하지 않는다. 시작·후기 모듈 지문을 구분하거나 혼합 빌드 가능성을 명시해야 한다.
- persistent profile의 Continue를 허용하므로 이번 프로세스가 초대장부터 시작했다는 뜻은 아니다. 이전 실행 체크포인트·동일 세션의 정상 이벤트 이력을 함께 확인해야 전체 실제 플레이의 계보를 주장할 수 있다.

추가 프로덕션 소스 변경이나 빌드는 하지 않았다.

## 공간 음향 후속 검증

최신 정적 빌드에서 실제 목표까지 키보드로 이동하고 캡션 버튼으로 행동을 실행했다. 종이·금속·목재 접촉은 각각 1회, 네 박자 행동은 정확히 4회였다. world 이벤트의 distance/pan이 audio diagnostics까지 동일하게 전달됐다. 일반 완료 효과의 중복은 관측하지 않았다.

같은 새 소리의 거리/좌우 값은 실제 이동 전 9.055/-0.905에서 이동 후 12.408/-0.951로 변했다. 같은 위치에서 카메라를 돌리자 거리는 12.408로 유지되고 pan은 +0.212로 바뀌었다. 창 숨김과 실제 도착 대화 잠금 동안 각각 8초 관측에서 환경 이벤트가 추가되지 않았다. 정지한 역 시계의 주기적 발음은 소스에서 제거됐으며 JS 스케줄러 타이머도 0이다. 청취 품질 평가는 포함하지 않았다.

`spatial-report.json`과 `wood-report.json` 모두 errors=[]다. fixture 기반 부분 검증이며 전체 전편 플레이를 뜻하지 않는다. 현재 관련 dist 지문은 spatial-hashes.json에 남겼다.

P21 겹친 조사점 수정은 정확한 nearbyHotspot 함수로 재현해 검사했다. 같은 좌표에서 읽은 sequence보다 읽지 않은 interlock을 선택하고, 먼저 나오는 준비 행동·읽지 않은 조사점 순서는 유지한다. 실제 기존 P21 체크포인트 재개 검증은 리드가 담당한다.

## 중간편 엔딩의 다음 목적지 연결

현재 content/state/game 변경을 읽고 두 기존 집중 테스트 묶음 15개를 통과했다. nextEpisodeFor는 기존 출발 우선순위 계산을 공유 함수로 옮겼으며 저장 버전·payload·checksum과 이벤트 구조를 바꾸지 않는다. view의 nextEpisodeId는 파생 정보다.

최신 콘텐츠는 별도 명시적 2편 C 마지막 행동 직전 fixture에서 검증했다. 실제 이동 후 캡션 버튼으로 약도 인계를 완료하자 문정의 수리소 요청과 ‘다음 목적지는 수리소이다. 표지와 안내에 필요한 현장 장비를 정할 차례다’가 순서대로 나왔다. 대화 후 목표는 ‘수리소로 이동 · 출구에서 E’였다. 기존 이벤트 목록은 그대로이며 마지막 perform 한 건만 추가됐다. 오류는 없었다.

story-link-report.json에는 실제 로드한 content/state/game 응답 SHA-256을 기록했다. 이 결과는 진행 중인 실제 전편 여정의 이전 캐시 콘텐츠와 구분한다. 해당 전편 여정이 처음부터 이 최신 텍스트 빌드를 사용했다고 주장하지 않는다.
