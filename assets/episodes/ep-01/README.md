# 1편 — 폐관 후의 박물관

현재 구현된 편이다. 32종 소품·가구, 모로·윤서·플레이어·원격 단말 4종, 건축·표면 환경 7종으로 기본 모델 43종과 상태 변형 2개가 게임에 연결되어 있다. 회전 갤러리의 현재 카탈로그는 45항목이다. 기존 소품·배우 38항목의 검수 이력은 유지하고, 새 환경 7종을 포함한 전체 45항목의 환경 확장 검수를 완료했다.

| 자료 | 위치 |
| --- | --- |
| 원고와 연작 연결 | [1편 원고 안내](../../../docs/series/episode-01-bridge.md) |
| 편별 제작 브리프 | [brief.md](brief.md) |
| 실제 에셋 목록 | [manifest.json](manifest.json) |
| 현재 환경 확장 검수 | [환경 확장 기록](review/environment-upgrade/review.md) · [측정 JSON](review/environment-upgrade/verification.json) |
| 이전 소품 검수 이력 | [review/review.md](review/review.md) · [이전 측정 JSON](review/verification.json) |
| 소품 생성기 | [props.mjs](../../../public/assets/episodes/ep-01/props.mjs) |
| 배우·단말 생성기 | [actors.mjs](../../../public/assets/episodes/ep-01/actors.mjs) |
| 환경 생성기 | [environment.mjs](../../../public/assets/episodes/ep-01/environment.mjs) |
| 공통 코어 | [core.mjs](../../../public/assets/shared/core.mjs) |

각 모델의 관리 키는 `ep-01/<기존 모델 ID>`다. 런타임의 로컬 생성기 ID는 기존 값을 유지한다. 모로·플레이어·단말은 후속편의 재사용 후보이며, 실제 재사용 시 원본 경로와 revision을 고정하고 해당 편의 동행·전원·서사 상태를 다시 연결한다.

환경 범위는 방 바닥·양면 벽·문틀·복도·안뜰 길·물길·깔개·정비 띠·젖은 바퀴 자국이다. 문은 폭 3.6·유효 높이 2.30 단위를 확보한다. CanvasTexture 문자 표면, 선택/목적지 표시·접지 그림자와 WebGL 불가 시 접근 가능한 대체 표시는 기능별 표현 계층으로 유지한다. 복도는 지도 사각형의 방 중첩 부분을 빼고 실제 노출 간격 가로 4·세로 6 단위만 모델링했다. 방 위치와 동선은 유지한다. 전체 자동 렌더 1,080뷰·방 배치 108뷰와 대표 이미지·실제 게임 검수를 구분해 기록했으며 테스트 103개가 통과했다.

새 편의 작업은 [반복 제작 절차](../../SERIES_ASSET_WORKFLOW.md)와 [전체 편별 계획](../README.md)에서 시작한다.
