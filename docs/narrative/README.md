# 이야기와 게임 설계

《폐관 후의 박물관》은 전체 원고·상태머신·NPC AI·전체 화면 3D를 연결한 플레이 가능한 웹 게임이다. 현재 실행은 프로젝트 루트의 `npm start`이며, [실행 안내](../../README.md)와 [최종 검증](../../artifacts/final-evidence.md)을 함께 읽는다.

## 기준 문서

1. [이야기 설계](story-design.md): 진실·동기·챕터와 결말의 의미.
2. [선택과 이동](scene-routes.md): 21장면·84행동·89목적지 분기·자원 변화.
3. [루트맵](route-map.md): 분기와 합류 위치.
4. [전체 원고](../manuscript/README.md): 본문·선택 결과·조건부 후일담과 경로별 읽기 결과.
5. [전체 상태머신 계약](runtime-contract.md): 현재 게임의 이벤트·공개 경계·저장·재생.
6. [NPC 설계](npc-ai-design.md)와 [실제 API 연결](ai-integration.md): 추궁과 대화, 결정론적 행동 적용.
7. [게임 레퍼런스](game-references.md)와 [장면 연출](visual-direction.md): 인물·공간·발화·상태 표현.

이전 [T22 콘티](t22-storyboard.md)와 [T22 상태 설계](game-state-design.md)는 한 장면의 선행 구현 기록이다. 해당 엔진의 추궁 규칙은 전체 게임에서 재사용한다. `src/engine.js`·`src/story.js`·`src/types.d.ts`와 `docs/design.md`는 실행하지 않는 초기 초안이다.

## 제작 상태

[제작 작업 목록](../plan.md)의 순서에 따라 이야기 기준 → 전체 원고 → 경로별 읽기 → 게임 연결 → 화면·AI·연출 → 기술 리허설을 마쳤다. 작업은 원고·엔진·AI·화면·연출의 독립 범위로 병렬 진행했다.

11명·3팀·매 선택 A–D·텍스트 대화·GPT-Live 제외가 사용자 조건이다. 4/4/3명과 90분 행사는 진행안이며, 실제 참가자의 시간과 재미는 아직 측정하지 않았다. 같은 팀의 다중 기기 동시 조작·외부 배포는 구현 완료 범위에 포함하지 않는다.
