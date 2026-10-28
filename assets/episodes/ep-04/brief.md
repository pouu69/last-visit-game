# ep-04 — 수리소 에셋 제작 브리프

## 기본 정보

- 원고: `docs/series/episode-04-workshop.md` (원고 SHA-256: `manifest.json`의 `storyRevision.sources`)
- 이번 범위: 실제 3D 절차 생성기, 측정 bounds, parts와 충돌 프록시. 브라우저 갤러리 렌더와 부분 이미지 검토 완료; 게임 장면·모션 승인은 대기.
- 스타일: `series-art-v1`; `assets/shared/art-direction.md`
- 런타임: `public/assets/episodes/ep-04/props.mjs`. 월드는 `public/series-world.mjs`, 진입은 `public/series-game.mjs`, 갤러리는 `/asset-gallery.html?episode=4`, 저장은 `return-path-series-v2:<museum sessionId>`.
- 승인 상태: `modelled`; 브라우저 검수 완료를 뜻하지 않는다.

## 공간과 기술 조건

작업대·시험 공간·선반을 나눈다. 안내등 본체 하나와 고정/운반 받침, 차광판, 고정쇠, 주문서·점검 문서, 주간 손표지를 다룬다. 상태에 따라 고정 또는 이동 조립 중 하나만 배치한다.

- 좌표: Y-up, +Z 정면. 공통 `createAssetCore`와 팔레트 사용.
- 가구·인물은 바닥 중심, 얇은 문서는 받침 기준. 정확한 bounds는 `manifest.json` 자산별 값 참조.
- 갤러리 회전·배율 렌더와 부분 시각 QA를 기록했다. 실제 장면 배치 QA는 미완료. 아직 실제 방 수·통행폭을 확정하지 않았다.

## 원고 기반 자산

| 관리 키 | 표시 이름 | 원고 근거 | 유형 | 역할 | 구현 parts | 우선순위 |
| --- | --- | --- | --- | --- | --- | --- |
| `ep-04/guide-lamp` | 유리 안내등 | W40, W42 | 절차 모델 | 유리 안내등 | bulb, shade, base, latch | P1 |
| `ep-04/fixed-stand` | 고정 받침 | W44, W45-A | 절차 모델 | 고정 받침 | 정적 | P1 |
| `ep-04/carrying-base` | 낮은 운반대 | W44, W45-B | 절차 모델 | 낮은 운반대 | 정적 | P1 |
| `ep-04/hand-signs` | 주간 손표지 두 개 | W45-C | 절차 모델 | 주간 손표지 두 개 | signs | P1 |
| `ep-04/inspection-documents` | 주문서·점검 문서·조립 도면 | W40, W41-D, W42, W44 | 절차 모델 | 주문서·점검 문서·조립 도면 | 정적 | P1 |
| `ep-04/shade-panel` | 차광판과 연결축 | W42, W44 | 절차 모델 | 차광판과 연결축 | hinge, pin | P1 |
| `ep-04/wall-lamp-mount` | 벽 고정 등받침 | W44 | 절차 모델 | 벽 고정 등받침 | cradle | P1 |

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

9항목·24방향 216뷰와 대표 모델 배율 9장을 생성했다. root가 전 항목 4방향 contact sheet 36뷰를 실제 검토했다. 전체 이미지 개별 검토·장면 모션·게임 승인은 별도이며 `modelled`를 유지한다. [검수 기록](review/review.md)에 렌더와 육안 검토 범위를 구분했다.
