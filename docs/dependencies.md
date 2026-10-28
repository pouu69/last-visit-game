# 외부 의존성

사용자가 요청한 Three.js 공간 연출에만 외부 런타임 패키지를 사용한다. HTTP 서버·저장·원고 처리·AI 호출·화면 조작은 Node와 브라우저 표준 API다.

| 패키지 | 버전 | 라이선스 | 출처와 용도 |
| --- | --- | --- | --- |
| three | 0.186.1 | MIT | https://www.npmjs.com/package/three · 원본 https://github.com/mrdoob/three.js · 박물관 미니어처의 WebGL 렌더링 |

`package-lock.json`에 배포 파일의 SHA-512 integrity를 고정한다. MIT 원문은 배포 결과의 `node_modules/three/LICENSE`에 포함한다. 사용자 요청에 Three.js가 명시되어 있어 이 라이브러리를 도입했으며 추가 UI·AI SDK·물리 라이브러리는 도입하지 않았다.
