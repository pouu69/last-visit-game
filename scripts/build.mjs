import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const files = [
  ['node_modules/three/build/three.module.js', 'vendor/three.module.js'],
  ['node_modules/three/build/three.core.js', 'vendor/three.core.js'],
  ['node_modules/three/LICENSE', 'vendor/THREE-LICENSE.txt'],
];
for (const folder of ['src', 'public', 'docs/manuscript', 'docs/series']) {
  for (const entry of await readdir(resolve(root, folder), {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile()) continue;
    const source = relative(root, resolve(entry.parentPath, entry.name));
    if (source.split('/').some((part) => part.startsWith('.'))) continue;
    if (folder === 'src' && !source.endsWith('.mjs')) continue;
    if (folder === 'docs/manuscript' && !source.endsWith('.md')) continue;
    if (folder === 'docs/series' && (!/^episode-0[1-5]-[a-z]+\.md$/.test(entry.name) || source.includes('/archive/'))) continue;
    files.push([source, folder === 'public' ? source.slice('public/'.length) : source]);
  }
}

// Only generated output is replaced; local settings and historical sessions stay outside dist.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const manifest = {};
for (const [source, destination] of files.sort((a, b) => a[1].localeCompare(b[1]))) {
  let bytes = await readFile(resolve(root, source));
  if (source.endsWith('.mjs') || source.endsWith('.html')) {
    let text = bytes.toString('utf8');
    if (source.startsWith('src/'))
      text = text.replace(/(['"])\.\.\/public\/museum-map\.mjs\1/g, '$1../museum-map.mjs$1');
    if (source.startsWith('public/') && !source.slice(7).includes('/'))
      text = text.replace(/(['"])\.\.\/src\//g, '$1./src/');
    if (source === 'public/museum-scene.mjs')
      text = text.replace(/(['"])\/vendor\//g, '$1./vendor/');
    if (source.endsWith('.html'))
      text = text.replace(/\b(src|href)=(["'])\/(?!\/)/g, '$1=$2./');
    bytes = Buffer.from(text);
  }
  const target = resolve(output, destination);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  if (/\.(mjs|js)$/.test(destination))
    execFileSync(process.execPath, ['--check', target], { stdio: 'pipe' });
  manifest[destination] = {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
await writeFile(
  resolve(output, 'build-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);
process.stdout.write(`Built ${files.length} static files in dist/. Preview: npm start\n`);
