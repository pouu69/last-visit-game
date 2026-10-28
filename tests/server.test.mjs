import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreviewServer } from '../server.mjs';

const TIMEOUT_MS = 30_000;
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
const run = promisify(execFile);

test(
  'static build relocates browser assets and preview exposes no game API or private files',
  {
    timeout: TIMEOUT_MS,
  },
  async (t) => {
    await mkdir(output, { recursive: true });
    await writeFile(resolve(output, 'server.mjs'), 'stale server output');
    await writeFile(resolve(output, 'removed-npc-adapter.mjs'), 'stale adapter output');
    await run(process.execPath, ['scripts/build.mjs'], { cwd: root, timeout: TIMEOUT_MS });
    const manifest = JSON.parse(await readFile(resolve(output, 'build-manifest.json'), 'utf8'));
    const paths = (await readdir(output, { recursive: true })).sort();
    for (const required of [
      'index.html',
      'app.mjs',
      'style.css',
      'museum-map.mjs',
      'src/playbook.mjs',
      'docs/manuscript/chapter-1.md',
      'docs/manuscript/chapter-2.md',
      'docs/manuscript/chapter-3.md',
      'docs/manuscript/endings.md',
      'vendor/three.module.js',
      'vendor/three.core.js',
      'vendor/THREE-LICENSE.txt',
    ])
      assert.ok(manifest[required], `Missing deployable file: ${required}`);
    for (const path of paths)
      assert.doesNotMatch(
        path,
        /(^|\/)(\.env|data|node_modules|server\.mjs|npc-ai\.mjs|removed-npc-adapter\.mjs|public)(\/|$)/
      );

    // A host may mount the exact same files below /museum/; imports must remain inside it.
    const deployment = new URL('https://static.example/museum/');
    for (const path of Object.keys(manifest).filter((path) => /\.(mjs|js|html)$/.test(path))) {
      const source = await readFile(resolve(output, path), 'utf8');
      const references = path.endsWith('.html')
        ? [...source.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1])
        : [...source.matchAll(/\b(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g)].map(
            (match) => match[1]
          );
      for (const reference of references) {
        if (!reference.startsWith('.') && !reference.startsWith('/')) continue;
        const target = new URL(reference, new URL(path, deployment));
        assert.ok(
          target.pathname.startsWith(deployment.pathname),
          `${path}: ${reference} escapes subdirectory deployment`
        );
        const relative =
          target.pathname.slice(deployment.pathname.length) +
          (target.pathname.endsWith('/') ? 'index.html' : '');
        assert.ok(manifest[relative], `${path}: missing imported asset ${relative}`);
      }
    }
    const game = await readFile(resolve(output, 'src/playbook.mjs'), 'utf8');
    assert.ok(game.includes('../museum-map.mjs'));
    assert.ok(!game.includes('../public/museum-map.mjs'));

    const server = createPreviewServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of [
      '/',
      '/app.mjs',
      '/src/playbook.mjs',
      '/docs/manuscript/chapter-1.md',
      '/vendor/three.module.js',
    ]) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 200, path);
      assert.ok((await response.text()).length > 0, path);
    }
    const module = await fetch(`${base}/app.mjs`, { method: 'HEAD' });
    assert.equal(module.status, 200);
    assert.match(module.headers.get('content-type'), /text\/javascript/);
    assert.equal(await module.text(), '');
    for (const path of [
      '/.env',
      '/data/sessions/example.json',
      '/server.mjs',
      '/api/health',
      '/%2e%2e%2f.env',
    ])
      assert.equal((await fetch(`${base}${path}`)).status, 404, path);
    assert.equal((await fetch(`${base}/%E0%A4%A`)).status, 400);
    const rejected = await fetch(`${base}/`, { method: 'POST', body: '{}' });
    assert.equal(rejected.status, 405);
    assert.equal(rejected.headers.get('allow'), 'GET, HEAD');
    assert.deepEqual((await readdir(output, { recursive: true })).sort(), paths);
  }
);
