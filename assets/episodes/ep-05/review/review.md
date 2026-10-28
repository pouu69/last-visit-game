# ep-05 모델 렌더 및 부분 시각 검토

기록일: 2026-10-29. 렌더 실행과 이미지 검토는 root 담당자가 수행했다. 이 문서는 실제 report JSON의 개수·시점·오류·파일 존재를 대조하고 담당자의 검토 범위를 기록한다.

- 자동 렌더: 갤러리 13항목 × yaw 8방향 × pitch 25/43/70° = **312뷰**. report의 `errors`는 빈 배열이다.
- 배율: 대표 3항목 × 0.6/1/1.8 = **9장**. 배율 검사는 전체 모델의 모든 배율 조합이 아니다.
- 실제 이미지 검토: 모든 갤러리 항목의 yaw 0/90/180/270°·pitch 43°를 담은 contact sheet, **52뷰**. 나머지 방향을 전부 개별 육안 검토했다고 주장하지 않는다.
- 담당자 관찰: 검토한 범위에서 메시 구멍·받침 누락·공통 스타일 불일치를 발견하지 않았다. 추가로 `scale-shelter-0.6.png`를 확인했다.
- 자동 렌더 시각: report의 `generatedAt` = `2026-10-28T16:09:48.315Z`. UTC 기록이며 실행 당시의 증거다. 소스 변경 시 영향 범위를 다시 검사한다.

## 증거

- [렌더 보고서](../../../../artifacts/series-assets/ep-05/report.json)
- [4방향 전체 항목 contact sheet](../../../../artifacts/series-assets/ep-05/contact.png)
- [전체 갤러리 화면](../../../../artifacts/series-assets/ep-05/gallery.png)
- [manifest](../manifest.json)

갤러리 항목: `ideun`, `jeongyeon`, `munjeong`, `narae`, `neighbor`, `paper-stack`, `river-path-fork`, `role-board`, `shelter`, `shelter-bench`, `sohui`, `taeo`, `water-basin`.

## 승인 범위와 남은 검증

승인은 `modelled`로 유지한다. 프로젝트 절차의 `camera-reviewed`는 회전·배율뿐 아니라 모션·방 배치 확인도 요구한다. 이번 갤러리 전용 보고서에는 방·상태 캡처가 없으며 게임 배치·모션·NPC·조사·충돌·실제 플레이를 승인하지 않는다. 갤러리 카탈로그와 편별 manifest 자산 목록은 공용 배우 재사용 때문에 개수와 구성 범위가 다르다.

## 실제 전편 검증 갱신

동일 정상 기록의 실제 1편부터 5편 complete/revision39까지 완료했고 `artifacts/series-full-play/canonical-journey.json`으로 공식 저장 복원·상태·필수 행동을 검증했다. 최신136/136검사·67파일 빌드가 통과했다. 이는 대표 실제 경로의 증거이며 이 카탈로그 모든 항목·상태·모션의 개별 게임 승인은 아니다. 후속편 네 공간의 대표9시점·4개 동작 구간·69~74.6초 전환 구간을 root가 최종 검토해 통과했다. 검토 범위에서 보행·동행 대형·NPC 몸짓·소품/UI 순서를 확인하고 뚜렷한 관통·빈/오류 전환 프레임을 발견하지 않았다. 전체 영상 전수 검토나 전체 카탈로그의 개별 게임 승인은 아니므로 관리 승인 `modelled`를 유지한다. 대표 게임 경로의 최종 수락은 완료했다.
