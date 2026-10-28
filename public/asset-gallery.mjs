import * as THREE from './vendor/three.module.js';
import { createAssetCore, MUSEUM_PALETTE } from './assets/shared/core.mjs';
import { createMuseumProps } from './assets/episodes/ep-01/props.mjs';
import { createMuseumActors } from './assets/episodes/ep-01/actors.mjs';

const labels = {
  'exhibit-case': ['빈 유리 진열장', '전시'], 'archive-desk': ['기록 책상과 독서등', '기록'],
  courtyard: ['안뜰 화단과 배수로', '정비'], 'storage-bays': ['반환 보관함과 인양기', '보관'],
  'paper-boat': ['종이배', '증거물'], ledger: ['원본 장부', '증거물'],
  'sealed-cover': ['밀봉 보관함', '보관'], 'original-guard': ['원본 잠금 덮개', '보관'],
  trolley: ['모로 운반 대차', '운반'], 'notice-board': ['일정 안내판', '전시'],
  valve: ['배수 밸브', '정비'], supplies: ['공구 보관함', '정비'], battery: ['배터리', '정비'],
  'archive-shelf': ['기록 서가', '기록'], 'stamp-set': ['도장 작업판', '기록'],
  'key-bundle': ['열쇠 꾸러미', '기록'], 'layered-label': ['겹쳐 붙인 표제', '기록'],
  'control-panel': ['인양 제어판', '인양'], 'packing-table': ['포장 작업대', '접수'],
  'preservation-kit': ['보존 도구 세트', '접수'], 'exit-door': ['목재 출입문', '건축'],
  'office-desk': ['관장실 책상', '기록'], cupboard: ['관장실 수납장', '기록'],
  'reception-counter': ['반환 접수대', '접수'], bench: ['로비 벤치', '전시'],
  'map-lectern': ['박물관 안내대', '전시'], clock: ['관장실 시계', '전시'],
  'tools-rack': ['정비 도구 걸이', '정비'], 'document-tray': ['서류 받침', '접수'],
  invitation: ['야간 관람 초대장', '기록'], 'arch-window': ['아치 창문', '건축'],
  'pipe-fixture': ['황동 배관', '정비'], moro: ['안내 로봇 모로', '인물'],
  curator: ['관장 윤서', '인물'], player: ['관람객', '인물'], terminal: ['원격 메시지 단말', '접수'],
};
const $ = (id) => document.getElementById(id);
const geometries = new Set(), materials = new Set(), textures = new Set();
const geometry = (value) => (geometries.add(value), value);
const material = (color, options = {}) => {
  const value = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...options });
  materials.add(value);
  return value;
};
const paint = Object.fromEntries(Object.entries(MUSEUM_PALETTE).map(([id, color]) => [id, material(color)]));
paint.brass.metalness = 0.28;
paint.brass.roughness = 0.6;
const core = createAssetCore(THREE, {
  geometry, material, paint,
  glass: material('#85aaa0', { transparent: true, opacity: 0.12, depthWrite: false, roughness: 0.35 }),
  signal: material('#c9dbb0', { emissive: '#9dc177', emissiveIntensity: 0.7 }),
  waterPaint: material(MUSEUM_PALETTE.water, { transparent: true, opacity: 0.78, roughness: 0.3 }),
  contact: material('#384b3d', { transparent: true, opacity: 0.17, depthWrite: false }),
});
const props = createMuseumProps(core), actors = createMuseumActors(core);
const catalog = [...props.ids, ...actors.ids].map((id) => ({ id, label: labels[id]?.[0] ?? id, family: labels[id]?.[1] ?? '기타' }));
catalog.push({ id: 'paper-boat-damaged', label: '종이배 · 손상', family: '증거물', source: 'paper-boat', options: { damaged: true } });
catalog.push({ id: 'ledger-blurred', label: '원본 장부 · 번짐', family: '증거물', source: 'ledger', options: { blurred: true } });
const lookup = new Map(catalog.map((entry) => [entry.id, entry]));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e4dfc8');
const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('stage').append(renderer.domElement);
scene.add(new THREE.HemisphereLight('#8ba8bd', '#253d37', 0.9));
const key = new THREE.DirectionalLight('#ffce8a', 1.45);
key.position.set(-4, 9, 6);
const fill = new THREE.DirectionalLight('#93b5d8', 0.7);
fill.position.set(6, 5, -2);
scene.add(key, fill);
const plinth = new THREE.Mesh(geometry(new THREE.CylinderGeometry(1, 1, 0.08, 48)), material('#d8d1b5'));
scene.add(plinth);
const shadow = new THREE.Mesh(geometry(new THREE.CircleGeometry(1, 48)), core.contact);
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);
const normalMaterial = new THREE.MeshNormalMaterial();
materials.add(normalMaterial);
const defaults = { yaw: 35, pitch: 43, zoom: 1 };
const settings = { ...defaults };
const cache = new Map(), originalMaterials = new WeakMap();
const abort = new AbortController();
let active = null, activeId = null, width = 1, height = 1, frame = null;
let disposed = false, paused = false, autoturn = false, wireframe = false, normals = false;
let previous = 0, bounds = new THREE.Box3(), center = new THREE.Vector3(), frames = 0;

function refreshMaterialMode() {
  if (!active) return;
  active.group.traverse((object) => {
    if (!object.isMesh) return;
    if (!originalMaterials.has(object)) originalMaterials.set(object, object.material);
    const originals = originalMaterials.get(object);
    for (const value of Array.isArray(originals) ? originals : [originals]) value.wireframe = wireframe;
    normalMaterial.wireframe = wireframe;
    object.material = normals ? normalMaterial : originals;
  });
}

function setCamera(next = {}) {
  if (disposed) return false;
  for (const key of ['yaw', 'pitch', 'zoom']) if (next[key] !== undefined && !Number.isFinite(next[key])) throw new TypeError(`${key} must be finite`);
  if (next.yaw !== undefined) settings.yaw = ((next.yaw % 360) + 360) % 360;
  if (next.pitch !== undefined) settings.pitch = THREE.MathUtils.clamp(next.pitch, 25, 70);
  if (next.zoom !== undefined) settings.zoom = THREE.MathUtils.clamp(next.zoom, 0.6, 1.8);
  $('zoom').value = String(settings.zoom);
  for (const button of document.querySelectorAll('[data-pitch]')) button.setAttribute('aria-pressed', String(Number(button.dataset.pitch) === settings.pitch));
  $('camera-readout').textContent = `회전 ${Math.round(settings.yaw)}° · 높이 ${Math.round(settings.pitch)}° · ${Math.round(settings.zoom * 100)}%`;
  render();
}

function select(id) {
  if (disposed) return false;
  const entry = lookup.get(id);
  if (!entry) throw new RangeError(`Unknown asset: ${id}`);
  if (!cache.has(id)) {
    const library = actors.ids.includes(entry.source ?? id) ? actors : props;
    cache.set(id, library.create(entry.source ?? id, entry.options ?? {}));
  }
  if (active) active.group.removeFromParent();
  active = cache.get(id);
  activeId = id;
  scene.add(active.group);
  active.group.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(active.group);
  if (bounds.isEmpty()) throw new Error(`${id} has no geometry`);
  bounds.getCenter(center);
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.hypot(size.x, size.z) * 0.64 + 0.12;
  plinth.scale.set(radius, 1, radius);
  plinth.position.set(center.x, bounds.min.y - 0.07, center.z);
  shadow.scale.set(size.x * 0.56, size.z * 0.56, 1);
  shadow.position.set(center.x, bounds.min.y - 0.024, center.z);
  $('asset-select').value = id;
  $('asset-title').textContent = entry.label;
  $('asset-family').textContent = `${entry.family} · ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} 단위`;
  $('stage').setAttribute('aria-label', `${entry.label} 3D 미리보기. 드래그로 카메라 회전`);
  for (const button of document.querySelectorAll('[data-asset]')) button.setAttribute('aria-current', String(button.dataset.asset === id));
  refreshMaterialMode();
  render();
  return diagnostics();
}

function aim() {
  const yaw = THREE.MathUtils.degToRad(settings.yaw), pitch = THREE.MathUtils.degToRad(settings.pitch);
  camera.position.copy(center).add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(20));
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  const inverse = camera.matrixWorldInverse;
  let halfX = 0, halfY = 0;
  const point = new THREE.Vector3();
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    point.set(x, y, z).applyMatrix4(inverse);
    halfX = Math.max(halfX, Math.abs(point.x));
    halfY = Math.max(halfY, Math.abs(point.y));
  }
  const aspect = width / height;
  const halfHeight = Math.max(halfY, halfX / aspect, 0.12) * 1.23 / settings.zoom;
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}
function render() {
  if (disposed || !active) return;
  aim();
  renderer.render(scene, camera);
  frames++;
  $('metrics').textContent = `${renderer.info.render.calls} draw calls · ${renderer.info.render.triangles.toLocaleString()} triangles`;
}
function diagnostics() {
  let meshes = 0, sprites = 0;
  active?.group.traverse((object) => { if (object.isMesh) meshes++; if (object.isSprite) sprites++; });
  return { id: activeId, camera: { ...settings }, bounds: bounds.toArray?.() ?? { min: bounds.min.toArray(), max: bounds.max.toArray() }, meshes, sprites, frames, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, viewport: { width, height, dpr: renderer.getPixelRatio() }, postPasses: 0, paused, autoturn, wireframe, normals };
}
function resize() {
  const rect = $('stage').getBoundingClientRect();
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  renderer.setSize(width, height, false);
  render();
}
function listen(node, event, handler, options = {}) { node.addEventListener(event, handler, { ...options, signal: abort.signal }); }
function toggle(id, get, set) { listen($(id), 'click', () => { set(!get()); $(id).setAttribute('aria-pressed', String(get())); render(); }); }
for (const entry of catalog) {
  const option = document.createElement('option'); option.value = entry.id; option.textContent = `${entry.family} · ${entry.label}`; $('asset-select').append(option);
}
for (const family of new Set(catalog.map((entry) => entry.family))) {
  const title = document.createElement('p'); title.className = 'family-name'; title.textContent = family; $('asset-list').append(title);
  for (const entry of catalog.filter((item) => item.family === family)) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.asset = entry.id; button.textContent = entry.label;
    listen(button, 'click', () => select(entry.id)); $('asset-list').append(button);
  }
}
for (const [id, color] of Object.entries(MUSEUM_PALETTE)) { const swatch = document.createElement('span'); swatch.style.background = color; swatch.title = `${id} ${color}`; $('palette').append(swatch); }
listen($('asset-select'), 'change', () => select($('asset-select').value));
listen($('yaw-left'), 'click', () => setCamera({ yaw: settings.yaw - 45 }));
listen($('yaw-right'), 'click', () => setCamera({ yaw: settings.yaw + 45 }));
listen($('reset'), 'click', () => setCamera(defaults));
for (const button of document.querySelectorAll('[data-pitch]')) listen(button, 'click', () => setCamera({ pitch: Number(button.dataset.pitch) }));
listen($('zoom'), 'input', () => setCamera({ zoom: Number($('zoom').value) }));
toggle('autoturn', () => autoturn, (value) => { autoturn = value; });
toggle('pause', () => paused, (value) => { paused = value; });
toggle('wireframe', () => wireframe, (value) => { wireframe = value; refreshMaterialMode(); });
toggle('normals', () => normals, (value) => { normals = value; refreshMaterialMode(); });
let drag = null;
listen($('stage'), 'pointerdown', (event) => { if (event.button > 0) return; drag = { id: event.pointerId, x: event.clientX, y: event.clientY }; $('stage').setPointerCapture(event.pointerId); });
listen($('stage'), 'pointermove', (event) => { if (!drag || drag.id !== event.pointerId) return; setCamera({ yaw: settings.yaw - (event.clientX - drag.x) * 0.4, pitch: settings.pitch + (event.clientY - drag.y) * 0.3 }); drag.x = event.clientX; drag.y = event.clientY; });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) listen($('stage'), event, () => { drag = null; });
listen($('stage'), 'wheel', (event) => { event.preventDefault(); setCamera({ zoom: settings.zoom * Math.exp(-event.deltaY * 0.001) }); }, { passive: false });
listen($('stage'), 'keydown', (event) => {
  const updates = { ArrowLeft: { yaw: settings.yaw - 15 }, ArrowRight: { yaw: settings.yaw + 15 }, ArrowUp: { pitch: settings.pitch + 8 }, ArrowDown: { pitch: settings.pitch - 8 } };
  if (updates[event.key]) { event.preventDefault(); setCamera(updates[event.key]); }
});
const observer = new ResizeObserver(resize); observer.observe($('stage'));
function tick(now) {
  if (disposed) return;
  if (now - previous >= 1000 / 30) {
    const elapsed = Math.min((now - previous) / 1000, 0.1); previous = now;
    if (autoturn && !paused && !document.hidden) setCamera({ yaw: settings.yaw + elapsed * 18 });
  }
  frame = requestAnimationFrame(tick);
}
function dispose() {
  if (disposed) return;
  disposed = true; cancelAnimationFrame(frame); observer.disconnect(); abort.abort();
  for (const value of geometries) value.dispose(); for (const value of materials) value.dispose(); for (const value of textures) value.dispose();
  renderer.dispose(); renderer.domElement.remove(); cache.clear();
  scene.clear(); active = null; activeId = null;
  geometries.clear(); materials.clear(); textures.clear();
  if (window.assetGallery?.dispose === dispose) delete window.assetGallery;
}
listen(window, 'pagehide', dispose);
window.assetGallery = { select, setCamera, diagnostics, catalog, dispose };
try { resize(); select('moro'); setCamera(defaults); document.documentElement.dataset.ready = 'true'; frame = requestAnimationFrame(tick); }
catch (error) { $('error').textContent = `오브젝트를 표시하지 못했습니다: ${error.message}`; throw error; }
