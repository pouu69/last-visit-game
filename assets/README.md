# 5편 스토리의 에셋 제작 자료

새 편을 만들 때는 **[반복 제작 절차](SERIES_ASSET_WORKFLOW.md)**부터 읽는다. [편별 목록](episodes/README.md)에서 해당 원고와 제작 상태를 확인하고, [템플릿](templates/)을 그 편의 폴더로 복사한다.

| 위치 | 내용 |
| --- | --- |
| `shared/` | 5편 공통 스타일과 기준 이미지 |
| `episodes/ep-01/` | 현재 박물관의 브리프·실제 manifest·검수 결과 |
| `episodes/ep-02/`~`ep-05/` | 해당 편의 원고 기반 제작 계획. 실제 모델은 아직 없음 |
| `templates/` | 매 편 복사할 브리프·manifest·검수 기록 양식 |
| [OBJECT_ASSET_GUIDE.md](OBJECT_ASSET_GUIDE.md) | Three.js 생성기·피벗·상태·충돌·자원 수명 구현 계약 |

실제 게임이 읽는 모델 소스는 `public/assets/`에 있다. 이 폴더의 기획·검수 자료는 게임 배포 파일과 분리해 관리한다. 폴더를 추가하거나 JSON을 작성하는 것만으로 새 편이 게임에 연결되지는 않는다.
