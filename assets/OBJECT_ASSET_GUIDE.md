# Three.js 오브젝트 구현 가이드

5편을 반복 제작할 때는 [시리즈 에셋 제작 절차](SERIES_ASSET_WORKFLOW.md)에서 시작한다. 이 문서는 공통 3D 구현 계약과 현재 1편의 연결 사례를 설명한다.

32종 소품·가구, 4종 배우·단말, 7종 건축·표면 환경으로 기본 모델 43종과 손상 종이배·번진 장부 2개 변형을 만들고 게임 씬에 연결했다. 현재 카탈로그는 45항목이다. 모델은 모두 로컬 좌표의 실제 3D 메시다. 스타일은 [아트 디렉션 브리프](shared/art-direction.md), 각 모델의 치수·삼각형 수·원점·충돌은 [manifest](episodes/ep-01/manifest.json)를 기준으로 관리한다.

## 1. 파일과 책임

| 파일 | 책임 |
| --- | --- |
| `public/assets/shared/core.mjs` | 공통 팔레트, bevel 상자, 원기둥, 구, 연결봉, 회전체, 메시 병합, 자원 등록 |
| `public/assets/episodes/ep-01/props.mjs` | 소품·가구 32종과 증거물 변형 생성 |
| `public/assets/episodes/ep-01/actors.mjs` | 모로, 윤서, 관람객, 원격 메시지 단말과 나래 초상 생성 |
| `public/assets/episodes/ep-01/environment.mjs` | 방 구조·복도·안뜰 길·물길·깔개·정비 띠·바퀴 자국 7종 생성 |
| `public/museum-scene.mjs` | 방 배치, 조사 지점, 캐릭터 이동, 이야기 상태와 가시성 연결 |
| `public/museum-colliders.mjs` | 로컬 충돌 프록시를 월드 좌표로 변환 |
| `public/asset-gallery.html` / `asset-gallery.mjs` | 동일한 생성 함수를 이용하는 모델 회전·형상 검수 |

`assets/shared/references/museum-object-style-target.png`는 색·재료·형태의 참고 시트다. 게임은 이 시트를 텍스처나 스프라이트로 렌더하지 않는다. 각도별 이미지를 교체하지 않고, 카메라를 움직이며 동일한 3D 형상을 다시 렌더한다.

## 2. 생성과 배치

```js
const core = createAssetCore(THREE, {
  geometry, material, paint, glass, signal, waterPaint, contact,
});
const props = createMuseumProps(core);
const actors = createMuseumActors(core);
const environment = createMuseumEnvironment(core);

const caseAsset = props.create('exhibit-case');
caseAsset.group.position.set(-0.8, 0, 0.1);
scene.add(caseAsset.group);

const damagedBoat = props.create('paper-boat', { damaged: true });
const blurredLedger = props.create('ledger', { blurred: true });
const moro = actors.create('moro');
const roomShell = environment.create('room-shell', {
  width: 12, depth: 10, roomType: 'gallery', doors: ['north', 'south'],
});
const corridor = environment.create('corridor-segment', { width: 16, depth: 3.6 });
```

`create()`는 아래 레코드를 반환한다. 새 인스턴스는 별도 그룹이므로 위치·가시성·상태가 서로 독립적이다. 정적 기하와 재료는 코어의 등록 함수를 통해 관리한다.

```js
{
  group,                 // 로컬 원점 기준 THREE.Group
  parts,                 // 애니메이션·재료·상태 변경에 사용하는 살아 있는 참조
  footprint: [x, z],     // 선언한 배치 크기; 실제 메시 측정은 manifest 참조
  height,                // 선언 높이
  pivot,                 // 원점 분류
  collision: []          // 로컬 좌표의 충돌 상자 목록
}
```

좌표계는 Y 위, 기본 정면은 +Z다. 큰 가구와 인물의 원점은 바닥 중심이다. 작은 소품은 받침면 또는 물품 중심을 사용한다. 배터리는 몸통 중앙(`body-center`), 시계는 벽 부착 중심(`wall-center`), 초대장은 패널 중앙(`panel-center`)이다. 장부·종이배·도장판·열쇠·겹표제는 받침면 부근(`support-center`)에 원점이 있다. 두께 때문에 원점 아래로 수 mm 내려가는 소품은 manifest의 실제 `bounds.min`을 기준으로 받침면을 맞춘다. 반환 레코드의 `pivot`과 `group.userData.assetPivot`이 같은 분류를 기록한다.

## 3. 상태 참조와 복제

| 생성 ID | `parts` | 사용 |
| --- | --- | --- |
| `storage-bays` | `water` | 공개된 장면 상태의 수위 |
| `notice-board` | `face`, `diagram` | 일정 텍스트와 방별 도식 |
| `valve` | `wheel` | 정비 상태의 회전 |
| `supplies` | `battery` | 보관함과 플레이어 소지 상태 연결 |
| `layered-label` | `flap` | 겹표제의 들림 |
| `control-panel` | `indicator` | 인양 상태의 표시등 재료 |
| `map-lectern`, `invitation` | `face` | CanvasTexture 기반 표면 글자 |
| `moro` | `eyes`, `antenna`, `antennaLight` | 눈·안테나·수면 상태 |
| `curator` | `body`, `head`, `arms`, `legs` | 짧은 몸짓·보행 |
| `player` | `legs` | 보행 |
| `terminal` | `screen`, `portrait`, `dots` | 화면 안의 원격 초상과 메시지 |
| `room-shell` | `label` | 후면·두께를 가진 바닥 이름표와 CanvasTexture 표면 |

위 참조는 병합 뒤에도 살아 있다. 나래는 단말 화면의 `portrait`이며 방 안에 별도 배우로 생성하지 않는다. 메시 가시성은 공개된 게임 상태를 따라 설정한다. 원본·종이배가 회수 전에 포장대에 나타나거나, 수면 중 모로의 눈과 안테나가 동작하지 않도록 씬 연결을 유지한다.

`group.clone(true)`는 계층을 복제하고 기하·재료는 공유한다. 반환 레코드의 `parts` 객체를 새 복제의 참조로 간주하지 않는다. 복제 뒤 `getObjectByName()`으로 상태 부품을 다시 찾는다. 표준 이름은 `board-face`, `board-diagram`, `unique-battery`, `crane-indicator`, `remote-screen`, `remote-portrait`, `message-dots`다. 복제 하나의 재료 속성만 변경하려면 재료도 복제해 등록한다.

## 4. 충돌과 조사

`group.userData.assetColliders`는 다음 로컬 상자 배열이다.

```js
[{ minX, maxX, minY, maxY, minZ, maxZ }]
```

`collectStaticColliders()`는 그룹의 최종 위치·회전·크기를 적용해 월드 충돌로 변환한다. 명시적 프록시가 있는 모델은 렌더 메시의 전체 바운딩박스로 충돌을 다시 추론하지 않는다. 문은 통행 구멍을 비우고 문설주와 열린 문짝이 실제 차지하는 영역을 막는다. 보관 베이는 내부까지 진입할 수 없도록 하나의 직사각형 영역을 막는다.

환경의 방 출입구는 폭 3.6·유효 높이 2.30 단위를 확보한다. 문설주 발받침과 벽 마감도 통행 구멍 안으로 들어오지 않는다. 복도 난간만 실제 충돌을 가지며 바닥·깔개·표면 장식·물길·바퀴 자국은 정적 장애물이 아니다. 방의 일반 wrapper 아래에 `room-shell`과 가구를 형제 노드로 둔다. wrapper 자체에 명시적 충돌 배열을 두면 자식 가구의 충돌 탐색이 생략될 수 있으므로 피한다.

모로·윤서·관람객은 정적 모델 충돌 대신 씬의 이동 본체 반지름을 사용한다. 소지품과 증거물은 정적 충돌을 만들지 않는다. 조사는 기존 hotspot ID와 `parts`/씬 위치에 연결하며 모델 생성 함수에서 이야기 진행이나 자원 획득을 처리하지 않는다.

## 5. 형태·재료·자원 규칙

- 가구는 목재 큰 면, 녹색 보조 면, 황동 연결부로 통일한다. 제조 부품은 완만한 bevel을 사용한다.
- 종이배와 잎은 두께를 가진 닫힌 삼각 판으로 만든다. 유리·일정판·창틀·문·단말 케이스에는 앞/뒤와 측면이 있다.
- 글자는 CanvasTexture로 만든다. 텍스처가 있는 얇은 상자는 정규화된 UV를 가진 BoxGeometry를 사용해 글자가 잘리지 않게 한다.
- 정적 Mesh는 같은 그룹 안에서 재료별로 병합한다. 애니메이션용 Group의 피벗은 유지한다.
- 색·가시성·재료가 바뀌는 Mesh는 `userData.keepMesh = true`로 지정해 병합에서 제외한다. Mesh 참조를 저장한 뒤 이를 생략하면 참조가 부모에서 제거될 수 있다.
- 자원은 `geometry()`·`material()` 등록 함수를 통해 생성한다. 반복 프레임에서 geometry·material을 만들지 않는다.
- 모델을 씬에서 제거하는 것과 공유 자원을 해제하는 것은 다르다. 개별 인스턴스 제거 시 공유 geometry/material을 dispose하지 않는다. 씬 또는 갤러리의 전체 수명 종료에서 등록한 자원을 한 번씩 해제한다.
- 새로운 CanvasTexture·디버그 재료도 등록 목록에 포함한다. `dispose()`에서는 렌더러, 관찰자, 이벤트, 프레임과 함께 해제한다.

## 6. 회전 갤러리

```bash
npm run build
npm start
```

기본 미리보기 주소는 `http://127.0.0.1:5188/asset-gallery.html`이다. 이미 다른 포트로 실행 중이면 그 서버의 `/asset-gallery.html`을 연다.

1. 목록에서 45개 모델/변형 중 하나를 선택한다.
2. 화면을 드래그하거나 45도 회전 버튼으로 앞·뒤·양 옆을 확인한다.
3. 높이 25°·43°·70° 버튼으로 낮은 시점과 상부를 확인한다.
4. 자동 회전, 확대, 와이어프레임, 법선 보기를 사용해 누락 면·두께·잘못된 방향을 찾는다.
5. 게임 씬에서 방 배치, 다른 가구와의 가림, 조사 접근, 상태 변형을 함께 확인한다.

화면은 카메라 각도와 draw calls/삼각형 수를 표시한다. 갤러리의 개별 모델 검수는 플레이 화면의 충돌·이야기 상태 검수를 대체하지 않는다.

## 7. 승인 기준과 현재 상태

기본 모델 43종과 상태 변형 2개, 총 45항목의 환경 확장 검수를 완료했다. 새 환경 revision `museum-environment-2026-10-28`도 게임 연결·카메라·통행·실제 플레이 확인을 거쳐 `approved-in-game`으로 마감했다. [환경 확장 검수 기록](episodes/ep-01/review/environment-upgrade/review.md)과 [측정 JSON](episodes/ep-01/review/environment-upgrade/verification.json)을 기준으로 한다.

최종 검수는 전체 45항목 × 24시점의 자동 렌더 1,080뷰, 9개 방 × 12시점의 배치 108뷰, 상태 4종·확대 12회·모션 7샘플을 포함한다. 자동 렌더 결과와 별도로 대표 contact sheet·건축 회전 모음·실제 게임 화면을 수동 확인했다. 이는 1,080장을 각각 육안 판정했다는 뜻이 아니다. 실제 UI의 초대장 조사·윤서 대화·로비→전시실 보행 도착과 yaw 125°·pitch 51° 카메라 조작을 확인했고, 테스트 103개가 통과했다.

기존 38항목·912뷰·81개 테스트의 기록은 [이전 소품 검수 이력](episodes/ep-01/review/review.md)으로 보존한다. 이후 모델·재료·상태 연결 변경 시에는 아래 기준으로 다시 확인한다.

- yaw 0°·45°·90°·135°·180°·225°·270°·315°와 pitch 25°·43°·70° 조합에서 외형과 후면을 확인한다.
- 확대와 축소에서 실루엣·글자·상태 차이가 읽힌다.
- 표면이 사라지거나, 두께가 없는 단면, 조명/그림자가 카메라에 붙어 움직이는 현상이 없다.
- 관람객·배우의 보행과 짧은 몸짓에서 피벗·지면 접촉이 유지된다.
- 공개된 게임 상태에 맞춰 회수·밀봉·손상·번짐·수면 상태가 표시된다.
- 방의 문과 통행로가 열려 있고 가구/보관함의 충돌이 시각적 크기와 맞는다.
- 실제 브라우저 수치와 관찰 결과를 검수 기록에 남긴 뒤 승인 상태를 갱신한다.

## 8. 환경 생성기 옵션과 범위

`createMuseumEnvironment(core)`는 공통 코어를 주입받고 `ids`, `revision`, `create()`를 반환한다. 환경 모델 revision은 `museum-environment-2026-10-28`이며 기존 소품·배우 revision과 구분한다.

| ID | 주요 옵션 | 배치와 충돌 |
| --- | --- | --- |
| `room-shell` | `width`, `depth`, `roomType`, `doors`, `labelMaterial` | 방 로컬 원점. 벽·문설주·발받침만 명시적 충돌 |
| `corridor-segment` | `width`, `depth` | 지도 사각형에서 실제 노출 간격만 모델링. 난간 구간만 충돌 |
| `courtyard-path` | 기본 안뜰 패턴 | 안뜰 로컬 원점. 충돌 없음 |
| `water-channel` | `width`, `depth` | 장식 물길. 충돌 없음 |
| `floor-rug` | `width`, `depth`, `tone` | 바닥 깔개. 충돌 없음 |
| `service-strip` | `width`, `depth` | 인양 제어실 정비 띠. 충돌 없음 |
| `wheel-trail` | 기본 바퀴 자국 패턴 | 전시실 로컬 원점. 충돌 없음 |

`ROOMS`와 `CONNECTIONS`가 실제 방 크기·위치·출입 방향을 결정한다. 복도 입력은 지도상의 긴 연결 사각형이지만 방과 겹치는 바닥을 중복 생성하지 않는다. 실제 노출 간격인 가로 4·세로 6 단위 구간만 바닥과 난간으로 만들며 방 위치와 이동 경로는 유지한다. 환경 모델이 새 방·통로·상태를 자체 생성하지 않는다. 1편의 가구·배우와 건축·표면은 에셋 생성기로 통일하며, 네이티브 문자 표면·선택/목적지 표시·접지 그림자는 기능별 표현을 담당한다. WebGL 불가 시 대체 표시는 정상 3D 씬과 별도다.
