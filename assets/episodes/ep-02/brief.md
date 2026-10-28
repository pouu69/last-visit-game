# ep-02 — 역 뒤뜰 에셋 제작 브리프

## 기본 정보

- 원고: `docs/series/episode-02-station.md` (원고 SHA-256: `manifest.json`의 `storyRevision.sources`)
- 이번 범위: 실제 3D 절차 생성기, 측정 bounds, parts와 충돌 프록시. 브라우저 갤러리 렌더와 부분 이미지 검토 완료; 게임 장면·모션 승인은 대기.
- 스타일: `series-art-v1`; `assets/shared/art-direction.md`
- 런타임: `public/assets/episodes/ep-02/props.mjs`, `public/assets/episodes/ep-02/actors.mjs`. 월드는 `public/series-world.mjs`, 진입은 `public/series-game.mjs`, 갤러리는 `/asset-gallery.html?episode=2`, 저장은 `return-path-series-v2:<museum sessionId>`.
- 승인 상태: `modelled`; 브라우저 검수 완료를 뜻하지 않는다.

## 공간과 기술 조건

뒤뜰·폐역 화물실·계단과 별도 보행로. 반송 상자와 세 겹의 스티커, 앞뒤 표지, 접이식 받침, 왕복 약도가 핵심이다. 문정과 이웃은 독립 모델이며 역·위쪽 쉼터 위치가 갈린다.

- 좌표: Y-up, +Z 정면. 공통 `createAssetCore`와 팔레트 사용.
- 가구·인물은 바닥 중심, 얇은 문서는 받침 기준. 정확한 bounds는 `manifest.json` 자산별 값 참조.
- 갤러리 회전·배율 렌더와 부분 시각 QA를 기록했다. 실제 장면 배치 QA는 미완료. 아직 실제 방 수·통행폭을 확정하지 않았다.

## 원고 기반 자산

| 관리 키 | 표시 이름 | 원고 근거 | 유형 | 역할 | 구현 parts | 우선순위 |
| --- | --- | --- | --- | --- | --- | --- |
| `ep-02/route-sign` | 옛 푸른 이동 표지 | N20, N21-B, N25-D | 절차 모델 | 옛 푸른 이동 표지 | panel, front, rear | P1 |
| `ep-02/double-sign` | 새 이중 표지 | N25-B | 절차 모델 | 새 이중 표지 | panel, front, rear | P1 |
| `ep-02/sign-stand` | 행사 표지 받침 | N20, N25-B | 절차 모델 | 행사 표지 받침 | 정적 | P1 |
| `ep-02/return-crate` | 반송 화물 상자 | N20, N21-C | 절차 모델 | 반송 화물 상자 | lid | P1 |
| `ep-02/folded-map` | 출발·귀환 접이 약도 | N22, N23, N25-C | 절차 모델 | 출발·귀환 접이 약도 | left, right | P1 |
| `ep-02/station-clock` | 11:17 종착역 시계 | N20 | 절차 모델 | 11:17 종착역 시계 | hands | P1 |
| `ep-02/folding-support` | 접이식 표지 받침 | N25-B | 절차 모델 | 접이식 표지 받침 | legs | P1 |
| `ep-02/platform-bench` | 역 승강장 벤치 |  | 절차 모델 | 역 승강장 벤치 | 정적 | P1 |
| `ep-02/stroller` | 이웃의 유모차 |  | 절차 모델 | 이웃의 유모차 | 정적 | P1 |
| `ep-02/munjeong` | 문정 |  | 절차 모델 | 문정 | torso, head, arms, legs | P1 |
| `ep-02/neighbor` | 이웃 연우 |  | 절차 모델 | 이웃 연우 | torso, head, arms, legs | P1 |
| `ep-02/sohui` | 소희 |  | 절차 모델 | 소희 | torso, head, arms, legs | P1 |
| `ep-02/jeongyeon` | 정연 |  | 절차 모델 | 정연 | torso, head, arms, legs | P1 |
| `ep-02/taeo` | 태오 |  | 절차 모델 | 태오 | torso, head, arms, legs | P1 |
| `ep-02/ideun` | 이든 |  | 절차 모델 | 이든 | torso, head, arms, legs | P1 |
| `ep-02/narae` | 나래 |  | 절차 모델 | 나래 | torso, head, arms, legs | P1 |

## 인물 모델

- `munjeong`: `public/assets/episodes/ep-02/actors.mjs`에서 독립 전신 모델. 기준 bounds [0.8500000059604644, 1.6608000041723252, 0.4836000037193299] 월드 단위.
- `neighbor`: `public/assets/episodes/ep-02/actors.mjs`에서 독립 전신 모델. 기준 bounds [0.7700000059604645, 1.6048000041723254, 0.42120001673698426] 월드 단위.
- `sohui`: `public/assets/episodes/ep-02/actors.mjs`에서 독립 전신 모델. 기준 bounds [0.8100000059604644, 1.6496000041723253, 0.45239998698234557] 월드 단위.
- `jeongyeon`: `public/assets/episodes/ep-02/actors.mjs`에서 독립 전신 모델. 기준 bounds [0.7900000059604645, 1.6272000041723254, 0.43680000185966494] 월드 단위.
- `taeo`: `public/assets/episodes/ep-02/actors.mjs`에서 독립 전신 모델. 기준 bounds [0.9100000059604645, 1.6832000041723252, 0.5304000055789948] 월드 단위.
- `ideun`: `public/assets/episodes/ep-02/actors.mjs`에서 독립 전신 모델. 기준 bounds [0.8300000059604644, 1.6720000041723253, 0.4680000185966492] 월드 단위.
- `narae`: `public/assets/episodes/ep-02/actors.mjs`에서 독립 전신 모델. 기준 bounds [0.7900000059604645, 1.6216000041723253, 0.43680000185966494] 월드 단위.

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

11항목·24방향 264뷰와 대표 모델 배율 9장을 생성했다. root가 전 항목 4방향 contact sheet 44뷰를 실제 검토했다. 전체 이미지 개별 검토·장면 모션·게임 승인은 별도이며 `modelled`를 유지한다. [검수 기록](review/review.md)에 렌더와 육안 검토 범위를 구분했다.
