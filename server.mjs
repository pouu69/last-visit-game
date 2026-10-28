import { createServer } from 'node:http';
import { access, readFile } from 'node:fs/promises';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(ROOT, 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/** Serves generated files for local preview; GET and HEAD never mutate game or disk state. */
export function createPreviewServer({ directory = DIST } = {}) {
  const root = resolve(directory);
  return createServer(async (request, response) => {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('cache-control', 'no-cache');
    const fail = (status, message) => {
      response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : message);
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('allow', 'GET, HEAD');
      fail(405, '미리보기는 파일 읽기만 지원합니다. GET 또는 HEAD를 사용해 주세요.');
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      fail(400, '주소의 문자 인코딩을 읽지 못했습니다. 파일 주소를 확인해 주세요.');
      return;
    }
    if (
      pathname.includes('\\') ||
      pathname.includes('\0') ||
      pathname.split('/').some((part) => part.startsWith('.'))
    ) {
      fail(404, '배포 파일이 없습니다. dist 안의 파일 주소를 확인해 주세요.');
      return;
    }
    const file = resolve(
      root,
      `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`
    );
    if (!file.startsWith(`${root}${sep}`)) {
      fail(404, '배포 파일이 없습니다. dist 안의 파일 주소를 확인해 주세요.');
      return;
    }
    let bytes;
    try {
      bytes = await readFile(file);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code))
        fail(404, '배포 파일이 없습니다. npm run build 후 파일 주소를 확인해 주세요.');
      else fail(500, '배포 파일을 읽지 못했습니다. dist의 읽기 권한을 확인해 주세요.');
      return;
    }
    response.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'content-length': bytes.length,
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 5188);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error(
      `포트 ${process.argv[2]}는 1024~65535의 정수여야 합니다. npm start -- 5189처럼 실행하세요.`
    );
  try {
    await access(resolve(DIST, 'index.html'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await import('./scripts/build.mjs');
  }
  const server = createPreviewServer();
  server.on('error', (error) => {
    process.stderr.write(
      error.code === 'EADDRINUSE'
        ? `포트 ${port}이 사용 중입니다. npm start -- 5189처럼 다른 포트로 실행하세요.\n`
        : `미리보기를 열 수 없습니다 (${error.code}). 포트와 실행 권한을 확인해 주세요.\n`
    );
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () =>
    process.stdout.write(`정적 미리보기: http://127.0.0.1:${port}\n`)
  );
}
