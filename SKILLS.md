# Three.js 에이전트 스킬

이 프로젝트의 Codex 스킬 33개는 `.agents/skills/`에 설치되어 있습니다.

| 패키지                                                                                                       | 스킬 수 | 진입점                   |
| ------------------------------------------------------------------------------------------------------------ | ------- | ------------------------ |
| [Three.js Awesome Graphics Agent Skills](https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills) | 24      | `$threejs-skill-router`  |
| [Three.js Game Skills](https://github.com/majidmanzarpour/threejs-game-skills)                               | 9       | `$threejs-game-director` |

다음 턴부터 이 프로젝트에서 사용할 수 있습니다. 예시:

```text
$threejs-game-director를 사용해서 Three.js 브라우저 게임을 만들어줘.
그래픽 작업에는 threejs-skill-router와 관련 그래픽 스킬을 활용해줘.
```

설치한 원본 커밋과 전체 스킬 목록은 `.agents/skill-sources.json`에 기록했습니다.
원본 라이선스와 제3자 고지는 `.agents/skill-sources/`에 보존했습니다.
그래픽 패키지의 선언 라이선스는 `MIT AND GPL-3.0-only`, 게임 패키지는 `MIT`입니다.
각 예제와 에셋에 포함된 개별 라이선스 고지도 함께 보존했습니다.

기본 스킬 사용에는 API 키가 필요하지 않습니다. 외부 모델·이미지·오디오 생성 기능을
사용할 때는 각각 `TRIPO_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`가 필요합니다.

`threejs-procedural-materials`의 설명은 Codex 검증의 1,024자 제한에 맞춰 줄였습니다.
스킬 본문과 예제는 원본을 유지하며, 변경 전후 해시는 설치 기록에 포함했습니다.

## 프로젝트 MCP

[프로젝트 Codex 설정](.codex/config.toml)에 `threejsresources` MCP를 등록했습니다.
[Three.js Resources MCP](https://threejsresources.com/mcp)의 공개 원격 서버에
Streamable HTTP로 연결하며, API 키나 별도 npm 패키지 설치는 필요하지 않습니다.
공개 가이드·코드 예제·도구·레퍼런스를 조회하는 개발용 도구이며 게임 빌드에는 포함되지 않습니다.

Codex에서 이 프로젝트를 신뢰한 상태로 열고, 설정 추가 후에는 Codex를 재시작해 설정을
다시 불러옵니다. 프로젝트 설정의 적용 조건은 [Codex 공식 MCP 문서](https://developers.openai.com/codex/mcp)를
따릅니다. 원격 자료 조회에는 네트워크 연결이 필요합니다.

예시:

```text
threejsresources MCP에서 카메라와 충돌 관련 가이드를 찾아줘.
프로젝트의 Three.js 0.186.1과 예제의 지원 버전을 대조하고, 관련 스킬로 구현해줘.
```
