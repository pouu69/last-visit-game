# ep-05 — 강변 에셋 제작 브리프

## 기본 정보

- 원고: `docs/series/episode-05-river.md` (원고 SHA-256: `manifest.json`의 `storyRevision.sources`)
- 이번 범위: 실제 3D 절차 생성기, 측정 bounds, parts와 충돌 프록시. 브라우저 갤러리 렌더와 부분 이미지 검토 완료; 게임 장면·모션 승인은 대기.
- 스타일: `series-art-v1`; `assets/shared/art-direction.md`
- 런타임: `public/assets/episodes/ep-05/props.mjs`. 월드는 `public/series-world.mjs`, 진입은 `public/series-game.mjs`, 갤러리는 `/asset-gallery.html?episode=5`, 저장은 `return-path-series-v2:<museum sessionId>`.
- 승인 상태: `modelled`; 브라우저 검수 완료를 뜻하지 않는다.

## 공간과 기술 조건

역 뒤뜰에서 갈림점과 위쪽 쉼터까지의 보행 경로를 구분하고 옛 계선장은 경로에서 제외한다. 새 종이/배, 물대야, 반원 의자, 그늘 쉼터와 역할 기록을 모델링한다. 나래는 새 전신 모델이다.

- 좌표: Y-up, +Z 정면. 공통 `createAssetCore`와 팔레트 사용.
- 가구·인물은 바닥 중심, 얇은 문서는 받침 기준. 정확한 bounds는 `manifest.json` 자산별 값 참조.
- 갤러리 회전·배율 렌더와 부분 시각 QA를 기록했다. 실제 장면 배치 QA는 미완료. 아직 실제 방 수·통행폭을 확정하지 않았다.

## 원고 기반 자산

| 관리 키 | 표시 이름 | 원고 근거 | 유형 | 역할 | 구현 parts | 우선순위 |
| --- | --- | --- | --- | --- | --- | --- |
| `ep-05/water-basin` | 종이배 물대야 | R50, R51-B, R54-A | 절차 모델 | 종이배 물대야 | water | P1 |
| `ep-05/paper-stack` | 새 종이 묶음 | R50, R54 | 절차 모델 | 새 종이 묶음 | 정적 | P1 |
| `ep-05/shelter` | 위쪽 그늘 쉼터 | R50, R53 | 절차 모델 | 위쪽 그늘 쉼터 | 정적 | P1 |
| `ep-05/role-board` | 귀환 역할 기록판 | R50, R51-D, R53 | 절차 모델 | 귀환 역할 기록판 | face | P1 |
| `ep-05/river-path-fork` | 역 뒤뜰·쉼터 보행로 갈림점 | R50, R51-A | 절차 모델 | 역 뒤뜰·쉼터 보행로 갈림점 | cue | P1 |
| `ep-05/shelter-bench` | 밝은 쉼터 벤치 | R50, R53 | 절차 모델 | 밝은 쉼터 벤치 | 정적 | P1 |

## 인물 모델

- `public/assets/episodes/ep-02/actors.mjs`의 연작 인물 생성기를 사용한다. 편별 인물 참석·배치는 월드와 행동 계획에서 결정한다. 플레이어·모로는 1편 생성기를 사용한다.

## 상태·소유·이동 계약

- `create(id, options)`는 기하만 생성하며 선택, 지급, 인계, 공개 여부를 판정하지 않는다.
- 변경 부품은 `parts`로 반환한다. 이야기의 상태와 이동은 공개 상태를 받은 씬/게임 계층에서 소유한다.
- 충돌 박스는 각 자산 manifest에 실제 선언값을 기록했다. 빈 배열은 무충돌 의미가 아니라 정적 오브젝트가 보행을 막지 않는 상태다.
- 이전 편에서 실제 선택한 물품만 이동 가능하다. 원래 종이배/독창/조명 상태의 서사 규칙을 유지한다.

## 모델링 검수와 남은 작업

- 모델 생성 후 bounds, mesh/normal 유효성, parts 참조, collider 수치를 `tests/series-assets.test.mjs`로 검사한다.
- 갤러리 yaw 8×pitch 3 렌더와 대표 모델 0.6/1/1.8 배율 캡처를 완료했다. 실제 이미지 검토 범위는 아래 갱신 및 review/review.md를 참조한다. 전체 씬 배치·모션·실제 UI의 최종 통합 검수와 성능 측정은 미완료다. 부분 실행 증거와 전체 승인을 구분한다.
- 런타임 연결은 소스로 확인했으나 manifest 승인 단계는 `modelled`를 유지한다. `camera-reviewed`, `approved-in-game`으로 승격하지 않았다. 현재 증거와 미검증 항목은 `artifacts/series-requirements-audit.md`를 참조한다.

## 갤러리 렌더 검증 갱신

13항목·24방향 312뷰와 대표 모델 배율 9장을 생성했다. root가 전 항목 4방향 contact sheet 52뷰를 실제 검토했다. 전체 이미지 개별 검토·장면 모션·게임 승인은 별도이며 `modelled`를 유지한다. [검수 기록](review/review.md)에 렌더와 육안 검토 범위를 구분했다.
