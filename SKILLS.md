# 게임 개발 에이전트 스킬

프로젝트에는 총 **68개**의 Codex 스킬이 `.agents/skills/`에 설치되어 있습니다.
Three.js 제작 스킬 33개와 게임 공통 스킬 35개로 구성됩니다.

## 어떤 스킬을 쓸까

게임 개발 요청에는 먼저 `$router`를 사용합니다. 라우터가 프로젝트 엔진과 작업 종류를 확인해 필요한 스킬을 고릅니다. Three.js 시각·게임플레이 제작은 `$threejs-skill-router` 또는 `$threejs-game-director`를 바로 시작점으로 사용할 수 있습니다.

현재 게임은 Three.js 기반입니다. Three.js 스킬을 기본으로 사용하고, Phaser와 PixiJS 스킬은 해당 엔진을 실제 도입하는 작업에서만 사용합니다. Three.js와 PixiJS를 함께 사용하는 경우에도 PixiJS는 주로 별도 2D UI나 스프라이트 레이어가 필요할 때 선택합니다.

## 설치 목록

### Three.js 시각·그래픽 — 24개

`threejs-skill-router`, `threejs-atmosphere-aerial-perspective`, `threejs-bloom`, `threejs-camera-direction`, `threejs-exposure-color-grading`, `threejs-image-pipeline`, `threejs-parallax-occlusion-mapping`, `threejs-precipitation-surfaces`, `threejs-procedural-animation`, `threejs-procedural-architecture`, `threejs-procedural-fields`, `threejs-procedural-geometry`, `threejs-procedural-materials`, `threejs-procedural-planets`, `threejs-procedural-vegetation`, `threejs-procedural-vfx`, `threejs-raymarched-space-effects`, `threejs-screen-space-ambient-occlusion`, `threejs-shadow-systems`, `threejs-spectral-ocean`, `threejs-temporal-surfaces`, `threejs-visual-validation`, `threejs-volumetric-clouds`, `threejs-water-optics`

### Three.js 게임 제작 — 9개

`threejs-3d-generator`, `threejs-aaa-graphics-builder`, `threejs-audio-generator`, `threejs-debug-profiler`, `threejs-game-director`, `threejs-game-ui-designer`, `threejs-gameplay-systems`, `threejs-image-generator`, `threejs-qa-release`

### 엔진·렌더링 — 6개

- **Three.js — 현재 엔진:** `threejs-scene-setup`, `threejs-gltf-loading`, `threejs-materials-lighting`
- **Phaser — 선택 사용:** `phaser-core`, `phaser-arcade-physics`
- **PixiJS — 선택 사용:** `pixijs-rendering`

### 공통 게임 개발 분야 — 15개

`create-game-assets`, `game-ai`, `ai-behavior-trees-utility-ai`, `procedural-gen`, `dialogue-systems`, `save-systems`, `audio-design`, `shader-programming`, `physics-tuning`, `level-design`, `input-systems`, `game-feel`, `game-ui-ux`, `camera-systems`, `performance-optimization`

### 장르별 설계 — 9개

`platformer`, `roguelike`, `rpg`, `fps-shooter`, `tower-defense`, `card-game`, `visual-novel`, `survival-crafting`, `puzzle`

### 제작·배포 작업흐름 — 4개

`game-jam`, `prototype-fast`, `steam-publish`, `itch-publish`

### 게임 개발 라우터 — 1개

`router`

Godot, Unity, Unreal 등 웹 이외 엔진 스킬은 설치하지 않았습니다. 추가 게임 개발 스킬의 출처·커밋·전체 설치 목록은 [`.agents/skill-sources.json`](.agents/skill-sources.json)에 기록되어 있습니다. 각 저장소의 라이선스와 고지는 `.agents/skill-sources/` 아래에 보존했습니다.

## 원본 출처

| 묶음 | 수 | 진입 스킬 | 라이선스 |
| --- | ---: | --- | --- |
| [Three.js Awesome Graphics Agent Skills](https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills) | 24 | `$threejs-skill-router` | MIT AND GPL-3.0-only |
| [Three.js Game Skills](https://github.com/majidmanzarpour/threejs-game-skills) | 9 | `$threejs-game-director` | MIT |
| [Awesome GameDev Agent Skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | 35 | `$router` | Apache-2.0 |

기본 스킬 사용에는 API 키가 필요하지 않습니다. 기존 Three.js 이미지·오디오 생성 스킬 중 일부는 외부 생성 기능을 쓸 때 `TRIPO_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`가 필요합니다.

`threejs-procedural-materials`의 설명은 Codex 검증의 1,024자 제한에 맞춰 줄였습니다. 스킬 본문과 예제는 원본을 유지했고, 변경 전후 해시는 설치 기록에 있습니다.

## 프로젝트 MCP

[프로젝트 Codex 설정](.codex/config.toml)에 `threejsresources` MCP가 등록되어 있습니다. [Three.js Resources MCP](https://threejsresources.com/mcp)의 공개 원격 서버에서 가이드·예제·레퍼런스를 조회합니다. API 키나 별도 npm 패키지는 필요하지 않으며 게임 빌드에는 포함되지 않습니다.

Codex에서 프로젝트를 신뢰하고 재시작하면 설정을 다시 불러옵니다. 원격 자료 조회에는 네트워크 연결이 필요합니다.

예시:

```text
threejsresources MCP에서 카메라와 충돌 관련 가이드를 찾아줘.
프로젝트의 Three.js 0.186.1과 예제의 지원 버전을 대조하고, 관련 스킬로 구현해줘.
```
