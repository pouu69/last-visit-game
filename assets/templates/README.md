# 편별 제작 양식

이 폴더는 원본 양식이다. 실제 편에 맞는 내용은 `assets/episodes/ep-NN/`의 사본에 작성한다. 작업 순서는 [반복 제작 절차](../SERIES_ASSET_WORKFLOW.md)를 따른다.

| 파일 | 작성하는 시점 | 내용 |
| --- | --- | --- |
| [episode-brief.md](episode-brief.md) | 제작 시작 전 | 원고·스타일·목록·치수·상태·검수 계획 |
| [episode-manifest.json](episode-manifest.json) | 목록 작성부터 계속 | 원본·재사용·버전·소스·상태·실제 측정값·승인 |
| [episode-review.md](episode-review.md) | 검수 준비부터 계속 | 대상 revision·실행 환경·결과·수정·미확인 사항 |

JSON의 `assets`는 처음에는 비어 있다. `assetEntryTemplate`을 실제 계획 항목마다 복사해 `assets`에 추가하고, 사용한 양식 블록은 제거한다. 편 정보가 정해지면 `isTemplate`을 `false`로 바꾼다. 측정 전 수치와 미실행 결과는 `null`·`not-run`으로 유지한다.

`assetKey`는 `ep-02/route-sign`처럼 관리 범위를 포함하고 `id`는 생성기에 전달할 로컬 ID다. `reuse.action`은 `reuse`·`variant`·`new` 중 실제 결정으로 채운다. 재사용 시 원본 자산과 revision·해시·옵션을 기록한다.

`stateBindings`에는 공개 상태 키·조건·보일 부품·위치·hotspot 연결을, `ownershipAndLocation`에는 장면별 소유자와 물품 이동을 기록한다. 조건은 검토용 명세이며 문자열을 실행하는 방식으로 게임에 적용하지 않는다. 실행 상태 매핑은 해당 편의 씬 코드가 담당한다.

`runtime`과 검수 스크립트 경로는 실제 연결 후 채운다. 이 JSON을 복사했다고 편 선택·갤러리·저장 분리가 생기지는 않는다. 현재 1편의 [실제 manifest](../episodes/ep-01/manifest.json)는 완성 사례이며, 거기에 있는 승인·측정 결과를 새 편으로 복사하지 않는다.
