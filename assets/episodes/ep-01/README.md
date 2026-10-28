# 1편 — 폐관 후의 박물관

현재 구현된 편이다. 32종 소품·가구와 모로·윤서·플레이어·원격 단말 4종, 손상 종이배·번진 장부 2개 변형이 게임에 연결되어 있다.

| 자료 | 위치 |
| --- | --- |
| 원고와 연작 연결 | [1편 원고 안내](../../../docs/series/episode-01-bridge.md) |
| 편별 제작 브리프 | [brief.md](brief.md) |
| 실제 에셋 목록 | [manifest.json](manifest.json) |
| 검수 결과 | [review/review.md](review/review.md) · [측정 JSON](review/verification.json) |
| 소품 생성기 | [props.mjs](../../../public/assets/episodes/ep-01/props.mjs) |
| 배우·단말 생성기 | [actors.mjs](../../../public/assets/episodes/ep-01/actors.mjs) |
| 공통 코어 | [core.mjs](../../../public/assets/shared/core.mjs) |

각 모델의 관리 키는 `ep-01/<기존 모델 ID>`다. 런타임의 로컬 생성기 ID는 기존 값을 유지한다. 모로·플레이어·단말은 후속편의 재사용 후보이며, 실제 재사용 시 원본 경로와 revision을 고정하고 해당 편의 동행·전원·서사 상태를 다시 연결한다.

새 편의 작업은 [반복 제작 절차](../../SERIES_ASSET_WORKFLOW.md)와 [전체 편별 계획](../README.md)에서 시작한다.
