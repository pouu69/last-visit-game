import * as THREE from '/vendor/three.module.js';
import {
  ROOMS,
  CONNECTIONS,
  CORRIDORS,
  sceneRoomId,
  roomAt,
  spawnForRoom,
} from './museum-map.mjs';
import { canOccupy, moveBody } from './museum-collision.mjs';
import { collectStaticColliders } from './museum-colliders.mjs';

const PALETTE = {
  plaster: '#e4dfc8',
  edge: '#c3b99c',
  paper: '#fff2c7',
  fold: '#c6aa78',
  wood: '#704f40',
  brass: '#b18a54',
  green: '#486252',
  dark: '#243b37',
  tile: '#ddd6bd',
  ink: '#46594e',
  water: '#548a88',
  rust: '#9f5844',
};

function moroIsRevealed({ sceneId, storyVersion, hotspots = [] }) {
  if (sceneId === 'O00') return false;
  return (
    storyVersion !== 'museum-map-4' ||
    sceneId !== 'S01' ||
    hotspots.some((hotspot) => hotspot.anchor === 'moro')
  );
}

function sceneDescription(sceneId, flags, publicState = { sceneId }) {
  if (sceneId === 'O00')
    return '야간 관람을 기다리는 중앙 로비. 안내대에는 초대장이 놓여 있고, 관장 윤서가 그 옆에서 기다린다.';
  const showMoro = moroIsRevealed(publicState);
  const place = ['S12', 'T21', 'T22', 'D21', 'S22', 'P21', 'R31', 'R32'].includes(sceneId)
    ? '안전 격벽 너머의 반환실과 두 보관함'
    : sceneId === 'I03' || sceneId === 'D22'
    ? '낮은 담과 배수로가 있는 박물관 안뜰'
    : sceneId === 'I02'
    ? '접수 서류가 놓인 기록 책상'
    : sceneId === 'P12'
    ? '중앙 로비의 통행 안내대'
    : sceneId?.startsWith('E')
    ? '마지막 인계를 마친 박물관'
    : `아치창 아래의 빈 진열장${showMoro ? '과 안내 로봇 모로' : ''}`;
  const boat =
    {
      intact: '종이배는 온전하다.',
      damaged: '종이배 한쪽이 찢어져 있다.',
      sealed: '종이배는 봉인한 함 안에 있다.',
    }[flags.boat] ?? '';
  const moro = showMoro
    ? flags.moro === 'asleep'
      ? '모로의 화면이 꺼져 있다.'
      : '모로의 안내등이 켜져 있다.'
    : '';
  return [place + '.', boat, moro].filter(Boolean).join(' ');
}

function fallbackIllustration(root, description) {
  const frame = document.createElement('div');
  frame.innerHTML =
    '<svg viewBox="0 0 600 420" width="100%" height="100%" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="420" fill="#29443f"/><path d="M62 260 279 155 540 262 322 377Z" fill="#c4b99c"/><path d="M62 260V114L279 27V155Z" fill="#ded8c1"/><path d="M279 27 540 137V262L279 155Z" fill="#eee7d0"/><path d="M329 159V101Q355 64 381 123V181Z" fill="#73958a"/><path d="M423 198V140Q449 103 475 162V220Z" fill="#73958a"/><path d="M329 159 381 181M355 88V170M423 198 475 220M449 127V209" stroke="#b4a684" stroke-width="5"/><g data-fallback-case><path d="M201 246 265 220 328 247 264 277Z" fill="#f5edcf"/><path d="M201 246V291L264 319V277Z" fill="#b2a589"/><path d="M264 277V319L328 289V247Z" fill="#d8c8a4"/><path d="M222 214V166L265 147 307 165V214M222 166 265 186 307 165M265 186V232" fill="none" stroke="#79968a" stroke-width="3"/></g><g data-fallback-moro><path d="M375 291Q369 246 391 240Q419 242 414 290Z" fill="#e8dfbf"/><rect x="379" y="249" width="29" height="16" rx="5" fill="#28443e"/><path d="M386 256h4m8 0h4" stroke="#b7c68e" stroke-width="3"/><ellipse cx="379" cy="292" rx="7" ry="11" fill="#4a5041"/><ellipse cx="411" cy="292" rx="7" ry="11" fill="#4a5041"/></g><g data-fallback-invitation style="display:none"><path d="M210 252 270 225 345 255 283 287Z" fill="#704f40"/><path d="M210 252V297L283 331V287Z" fill="#486252"/><path d="M283 287V331L345 297V255Z" fill="#29443f"/><rect x="239" y="185" width="79" height="57" rx="3" fill="#fff2c7"/><text x="278" y="218" text-anchor="middle" font-size="18" fill="#29443f">초대장</text></g><path d="M74 301 163 258 199 275 111 319Z" fill="#6c8065"/><path d="M94 298 159 267M105 304 170 273" stroke="#9da58a" stroke-width="3"/></svg>';
  const caption = document.createElement('p');
  caption.textContent = description;
  caption.style.margin = '0';
  caption.style.position = 'static';
  caption.style.padding = '12px 20px';
  caption.style.color = '#f3edd9';
  caption.style.fontSize = '12px';
  caption.style.lineHeight = '1.7';
  frame.style.height = '100%';
  frame.style.display = 'grid';
  frame.style.gridTemplateRows = 'minmax(0,1fr) auto';
  frame.append(caption);
  root.replaceChildren(frame);
  return caption;
}

/** Public state owns discovery; this view only emits inspect intents for the supplied hotspots. */
export function mountMuseum(
  element,
  {
    onInspect = () => {},
    onArrive = () => {},
    onNavigation = () => {},
    onCameraChange = () => {},
  } = {}
) {
  const root = document.createElement('div');
  root.style.position = 'relative';
  root.style.width = '100%';
  root.style.height = '100%';
  root.style.minHeight = '180px';
  root.style.overflow = 'hidden';
  element.append(root);
  let current = {
    sceneId: 'S01',
    mode: 'map',
    currentRoomId: 'gallery',
    travel: null,
    flags: {},
    phase: 'reading',
    hotspots: [],
    activeHotspot: null,
    interactive: false,
  };
  let fallbackTravelButton = null;
  function syncFallbackControls() {
    const isLobby = current.sceneId === 'O00';
    const exhibit = root.querySelector('[data-fallback-case]'),
      robot = root.querySelector('[data-fallback-moro]'),
      invitation = root.querySelector('[data-fallback-invitation]');
    if (exhibit) exhibit.style.display = isLobby ? 'none' : '';
    if (robot) robot.style.display = moroIsRevealed(current) ? '' : 'none';
    if (invitation) invitation.style.display = isLobby ? '' : 'none';
    if (!fallbackTravelButton) {
      fallbackTravelButton = document.createElement('button');
      fallbackTravelButton.type = 'button';
      Object.assign(fallbackTravelButton.style, {
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '14px 20px',
        background: '#f1e5c4',
        color: '#173a32',
        border: '1px solid #b18a54',
        borderRadius: '6px',
      });
      fallbackTravelButton.addEventListener('click', () => {
        if (current.interactive && current.travel) onArrive(current.travel.toRoomId);
      });
      root.append(fallbackTravelButton);
    }
    fallbackTravelButton.hidden = !current.travel;
    fallbackTravelButton.disabled = !current.interactive;
    fallbackTravelButton.textContent = `${current.travel?.toLabel ?? '다음 방'}로 이동`;
    const [x, z] = spawnForRoom(current.currentRoomId ?? 'gallery');
    onNavigation({
      x,
      z,
      roomId: current.currentRoomId ?? 'gallery',
      targetRoomId: current.travel?.toRoomId ?? null,
      moving: false,
      nearbyLabel: null,
    });
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'low-power',
    });
  } catch {
    const caption = fallbackIllustration(
      root,
      sceneDescription(current.sceneId, current.flags, current)
    );
    syncFallbackControls();
    return {
      update(value) {
        current = value;
        caption.textContent = sceneDescription(value.sceneId, value.flags ?? {}, value);
        syncFallbackControls();
      },
      focus() {
        return false;
      },
      approach(id) {
        if (!current.interactive || !current.hotspots?.some((item) => item.id === id))
          return false;
        onInspect(id);
        return true;
      },
      adjustCamera() {
        return false;
      },
      resetCamera() {
        return false;
      },
      dispose() {
        root.remove();
      },
      diagnostics() {
        return {
          mode: 'illustration',
          reason: 'WebGL unavailable',
          sceneId: current.sceneId,
          calls: 0,
          triangles: 0,
          worldHotspots: false,
          hotspots:
            current.hotspots?.map(({ id, anchor, visited }) => ({ id, anchor, visited })) ?? [],
        };
      },
    };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor('#132c34');
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.setAttribute('role', 'application');
  root.append(renderer.domElement);
  const speakerMarker = document.createElement('div');
  speakerMarker.setAttribute('aria-hidden', 'true');
  Object.assign(speakerMarker.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    pointerEvents: 'none',
    display: 'none',
    padding: '5px 10px',
    borderRadius: '12px',
    border: '1px solid #baa77b',
    background: '#193932ed',
    color: '#f4ecd4',
    fontSize: '11px',
    lineHeight: '1.2',
    letterSpacing: '.04em',
    whiteSpace: 'nowrap',
  });
  root.append(speakerMarker);
  const hotspotLayer = document.createElement('div');
  hotspotLayer.setAttribute('aria-label', '박물관에서 조사할 대상');
  Object.assign(hotspotLayer.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
  });
  root.append(hotspotLayer);
  const hotspotButtons = new Map();
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-6, 6, 5, -5, 0.1, 100);
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const geometry = (value) => {
    geometries.add(value);
    return value;
  };
  const material = (color, options = {}) => {
    const value = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.88,
      metalness: 0,
      ...options,
    });
    materials.add(value);
    return value;
  };
  const paint = Object.fromEntries(
    Object.entries(PALETTE).map(([name, color]) => [name, material(color)])
  );
  const glass = material('#85aaa0', {
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    roughness: 0.35,
  });
  const windowGlass = material('#243c50', { emissive: '#25465a', emissiveIntensity: 0.3 });
  const signal = material('#c9dbb0', { emissive: '#9dc177', emissiveIntensity: 0.7 });
  const waterPaint = material(PALETTE.water, {
    transparent: true,
    opacity: 0.78,
    roughness: 0.3,
  });
  const contact = material('#384b3d', { transparent: true, opacity: 0.17, depthWrite: false });
  const unitBox = geometry(new THREE.BoxGeometry(1, 1, 1));
  const unitCylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 12));
  const unitSphere = geometry(new THREE.SphereGeometry(1, 12, 8));
  const staticRoot = new THREE.Group();
  const returnRoom = new THREE.Group();
  const caseRoot = new THREE.Group(),
    archiveDesk = new THREE.Group(),
    gardenRoot = new THREE.Group();
  scene.add(staticRoot, returnRoom, caseRoot, archiveDesk, gardenRoot);

  function solid(parent, shape, finish, position, scale, rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(shape, finish);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    parent.add(mesh);
    return mesh;
  }
  const box = (parent, finish, position, scale, rotation) =>
    solid(parent, unitBox, finish, position, scale, rotation);
  const cylinder = (parent, finish, position, scale, rotation) =>
    solid(parent, unitCylinder, finish, position, scale, rotation);
  const sphere = (parent, finish, position, scale) =>
    solid(parent, unitSphere, finish, position, scale);
  function beam(parent, finish, start, end, radius) {
    const from = new THREE.Vector3(...start),
      to = new THREE.Vector3(...end);
    const mesh = cylinder(parent, finish, from.clone().add(to).multiplyScalar(0.5).toArray(), [
      radius,
      from.distanceTo(to),
      radius,
    ]);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
    return mesh;
  }
  function arch(width, height) {
    const path = new THREE.Shape();
    path.moveTo(-width / 2, 0);
    path.lineTo(width / 2, 0);
    path.lineTo(width / 2, height - width / 2);
    path.absarc(0, height - width / 2, width / 2, 0, Math.PI, false);
    path.lineTo(-width / 2, 0);
    return geometry(new THREE.ShapeGeometry(path, 20));
  }

  // The first exhibit is visibly empty; the missing boat is never restored to this case.
  box(caseRoot, paint.edge, [-0.8, 0.12, 0.1], [1.76, 0.2, 1.4]);
  box(caseRoot, paint.plaster, [-0.8, 0.63, 0.1], [1.55, 0.92, 1.18]);
  box(caseRoot, paint.paper, [-0.8, 1.12, 0.1], [1.72, 0.08, 1.35]);
  box(caseRoot, paint.wood, [-0.8, 1.17, 0.1], [0.92, 0.025, 0.5]);
  for (const x of [-1.55, -0.05])
    for (const z of [-0.48, 0.68]) box(caseRoot, paint.brass, [x, 1.64, z], [0.025, 1, 0.025]);
  box(caseRoot, glass, [-0.8, 1.64, -0.48], [1.52, 1, 0.012]);
  box(caseRoot, glass, [-1.55, 1.64, 0.1], [0.012, 1, 1.16]);
  box(caseRoot, glass, [-0.8, 2.15, 0.1], [1.52, 0.015, 1.18]);
  box(caseRoot, paint.brass, [-0.8, 0.81, 0.704], [0.38, 0.14, 0.014]);
  box(caseRoot, paint.paper, [-0.8, 0.81, 0.717], [0.024, 0.08, 0.006]);
  for (const x of [-1.9, 0.3]) {
    cylinder(caseRoot, paint.brass, [x, 0.34, 1.18], [0.035, 0.64, 0.035]);
    cylinder(caseRoot, paint.wood, [x, 0.04, 1.18], [0.16, 0.06, 0.16]);
  }
  beam(caseRoot, paint.rust, [-1.9, 0.63, 1.18], [-0.8, 0.48, 1.18], 0.025);
  beam(caseRoot, paint.rust, [-0.8, 0.48, 1.18], [0.3, 0.63, 1.18], 0.025);

  // Archive desk: legs, drawer, offset paper stack, open ledger and reading lamp.
  box(archiveDesk, paint.wood, [-2.9, 0.87, -1.35], [1.65, 0.12, 0.85]);
  for (const x of [-3.58, -2.22])
    for (const z of [-1.65, -1.05]) box(archiveDesk, paint.wood, [x, 0.43, z], [0.1, 0.8, 0.1]);
  box(archiveDesk, paint.edge, [-2.9, 0.71, -0.95], [1.2, 0.19, 0.1]);
  box(archiveDesk, paint.brass, [-2.9, 0.71, -0.88], [0.22, 0.025, 0.04]);
  for (let page = 0; page < 4; page++)
    box(
      archiveDesk,
      paint.paper,
      [-3.23 + page * 0.015, 0.96 + page * 0.018, -1.37],
      [0.58, 0.012, 0.43],
      [0, -0.12, 0]
    );
  box(archiveDesk, paint.green, [-2.58, 0.96, -1.2], [0.48, 0.06, 0.34], [0, 0.1, 0]);
  box(archiveDesk, paint.paper, [-2.58, 1, -1.2], [0.43, 0.012, 0.29], [0, 0.1, 0]);
  cylinder(archiveDesk, paint.brass, [-3.4, 0.98, -1.58], [0.15, 0.05, 0.15]);
  beam(archiveDesk, paint.brass, [-3.4, 1, -1.58], [-3.4, 1.45, -1.58], 0.025);
  const shade = geometry(new THREE.ConeGeometry(0.23, 0.2, 16, 1, true));
  solid(archiveDesk, shade, paint.green, [-3.4, 1.5, -1.58], [1, 1, 1]);

  // The courtyard reads through cut-paper leaves and an exposed drainage line.
  box(gardenRoot, paint.green, [-2.5, 0.1, 2.32], [3.05, 0.15, 1.45]);
  for (const z of [1.56, 3.07])
    box(gardenRoot, paint.edge, [-2.5, 0.24, z], [3.25, 0.28, 0.16]);
  for (const x of [-4.06, -0.94])
    box(gardenRoot, paint.edge, [x, 0.24, 2.32], [0.16, 0.28, 1.6]);
  for (let i = 0; i < 7; i++)
    box(
      gardenRoot,
      paint.plaster,
      [-3.65 + i * 0.36, 0.19, 2.75],
      [0.27, 0.055, 0.45],
      [0, i % 2 ? 0.05 : -0.04, 0]
    );
  beam(gardenRoot, paint.wood, [-3.2, 0.2, 2.05], [-3.1, 1.25, 2.05], 0.06);
  beam(gardenRoot, paint.wood, [-3.15, 0.9, 2.05], [-3.55, 1.4, 2.05], 0.035);
  beam(gardenRoot, paint.wood, [-3.1, 1.1, 2.05], [-2.7, 1.55, 2.05], 0.035);
  const leafPath = new THREE.Shape();
  leafPath.moveTo(0, 0);
  leafPath.quadraticCurveTo(-0.42, 0.38, 0, 0.78);
  leafPath.quadraticCurveTo(0.4, 0.38, 0, 0);
  const leaf = geometry(new THREE.ShapeGeometry(leafPath, 6));
  const leafPaint = material('#809178', { side: THREE.DoubleSide });
  for (let i = 0; i < 11; i++) {
    const angle = i * 2.4;
    solid(
      gardenRoot,
      leaf,
      leafPaint,
      [-3.1 + Math.sin(angle) * 0.46, 0.97 + (i % 3) * 0.23, 2.03 + Math.cos(angle) * 0.27],
      [0.68, 0.74, 0.7],
      [0, angle, Math.sin(angle) * 0.8]
    );
  }
  box(gardenRoot, paint.dark, [0.2, 0.049, 2.5], [0.44, 0.025, 1.25]);
  for (let i = 0; i < 8; i++)
    box(gardenRoot, paint.brass, [0.2, 0.065, 1.96 + i * 0.15], [0.4, 0.035, 0.035]);

  // Two fixed storage bays behind a low safety barrier; props never suggest player entry.
  box(returnRoom, paint.dark, [2.55, 0.1, 0.1], [2.8, 0.15, 3.7]);
  box(returnRoom, paint.edge, [2.55, 0.25, -1.75], [2.9, 0.45, 0.16]);
  for (const x of [1.16, 3.94]) box(returnRoom, paint.edge, [x, 0.25, 0.1], [0.14, 0.45, 3.7]);
  box(returnRoom, paint.brass, [2.55, 0.32, 1.94], [2.9, 0.62, 0.11]);
  box(returnRoom, glass, [2.55, 0.98, 1.94], [2.78, 0.75, 0.025]);
  box(returnRoom, paint.brass, [2.55, 1.37, 1.94], [2.9, 0.045, 0.07]);
  const water = box(returnRoom, waterPaint, [2.55, 0.26, 0.08], [2.64, 0.04, 3.43]);
  for (let i = 0; i < 5; i++)
    box(
      returnRoom,
      paint.edge,
      [1.6 + i * 0.35, 0.29, 1.35 - (i % 2) * 0.1],
      [0.25, 0.006, 0.014]
    );
  for (const z of [-1.02, 0.75]) {
    box(returnRoom, paint.wood, [2.53, 0.48, z], [1.7, 0.18, 1.02]);
    box(returnRoom, paint.edge, [2.53, 0.6, z], [1.61, 0.08, 0.94]);
  }
  for (const z of [-1.65, 1.5]) {
    box(returnRoom, paint.wood, [3.55, 1.18, z], [0.09, 2.1, 0.09]);
    box(returnRoom, paint.brass, [2.55, 2.24, z], [2.1, 0.08, 0.1]);
  }
  box(returnRoom, paint.wood, [2.55, 2.3, -0.06], [0.12, 0.12, 3.38]);
  cylinder(
    returnRoom,
    paint.brass,
    [2.55, 2.15, -0.15],
    [0.19, 0.12, 0.19],
    [Math.PI / 2, 0, 0]
  );
  beam(returnRoom, paint.dark, [2.55, 2.08, -0.15], [2.55, 1.46, -0.15], 0.016);
  const hookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.55, 1.46, -0.15),
    new THREE.Vector3(2.55, 1.23, -0.15),
    new THREE.Vector3(2.71, 1.22, -0.15),
    new THREE.Vector3(2.75, 1.35, -0.15),
  ]);
  solid(
    returnRoom,
    geometry(new THREE.TubeGeometry(hookCurve, 12, 0.026, 6, false)),
    paint.brass,
    [0, 0, 0],
    [1, 1, 1]
  );

  function paperBoat(damaged) {
    const boat = new THREE.Group();
    const tip = damaged ? [0.59, 0.13, 0.04] : [0.83, 0.23, 0];
    const points = [
      [-0.83, 0.23, 0],
      tip,
      [-0.47, 0.08, 0.32],
      [0.47, 0.08, 0.32],
      [-0.47, 0.08, -0.32],
      [0.47, 0.08, -0.32],
      [0, 0, 0],
      [0, 0.52, 0],
    ];
    const faces = [
      [0, 2, 6],
      [2, 3, 6],
      [3, 1, 6],
      [0, 6, 4],
      [4, 6, 5],
      [5, 6, 1],
      [0, 7, 2],
      [2, 7, 3],
      [3, 7, 1],
      [0, 4, 7],
      [4, 5, 7],
      [5, 1, 7],
    ];
    const shape = geometry(new THREE.BufferGeometry());
    shape.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        faces.flatMap((face) => face.flatMap((index) => points[index])),
        3
      )
    );
    shape.computeVertexNormals();
    for (let i = 0; i < faces.length; i++) shape.addGroup(i * 3, 3, i % 3 === 0 ? 1 : 0);
    const mesh = new THREE.Mesh(shape, [paint.paper, paint.fold]);
    boat.add(mesh);
    beam(boat, paint.fold, [-0.82, 0.235, 0], [0, 0.525, 0], 0.009);
    beam(boat, paint.fold, [0, 0.525, 0], tip, 0.009);
    if (damaged)
      box(boat, paint.rust, [0.45, 0.17, 0.15], [0.12, 0.012, 0.08], [0.2, 0, -0.35]);
    return boat;
  }
  const boat = paperBoat(false),
    damagedBoat = paperBoat(true);
  for (const prop of [boat, damagedBoat]) {
    prop.position.set(2.53, 0.67, 0.75);
    prop.rotation.y = -0.12;
    returnRoom.add(prop);
  }
  const ledger = new THREE.Group();
  ledger.position.set(2.53, 0.68, -1.02);
  returnRoom.add(ledger);
  box(ledger, paint.green, [0, 0, 0], [0.94, 0.09, 0.65]);
  box(ledger, paint.paper, [0, 0.07, 0], [0.86, 0.06, 0.59]);
  for (let i = 0; i < 4; i++)
    box(ledger, paint.ink, [0.1, 0.104, -0.16 + i * 0.105], [0.44, 0.003, 0.012]);
  box(ledger, paint.rust, [-0.19, 0.11, 0], [0.03, 0.012, 0.55]);
  const blurredLedger = new THREE.Group();
  blurredLedger.position.copy(ledger.position);
  returnRoom.add(blurredLedger);
  box(blurredLedger, paint.green, [0, 0, 0], [0.94, 0.09, 0.65]);
  box(blurredLedger, paint.edge, [0, 0.07, 0], [0.86, 0.06, 0.59]);
  for (let i = 0; i < 3; i++)
    sphere(
      blurredLedger,
      paint.ink,
      [-0.15 + i * 0.15, 0.105, -0.1 + (i % 2) * 0.2],
      [0.15, 0.004, 0.1]
    );
  const sealedBoxes = [];
  for (const z of [0.75, -1.02]) {
    const lid = new THREE.Group();
    lid.position.set(2.53, 0.85, z);
    returnRoom.add(lid);
    box(lid, paint.green, [0, 0, 0], [1.65, 0.44, 0.95]);
    box(lid, paint.edge, [0, 0.25, 0], [1.7, 0.06, 1]);
    box(lid, paint.paper, [0, 0.285, 0], [0.18, 0.012, 1]);
    box(lid, paint.rust, [0, 0.3, 0.1], [0.13, 0.02, 0.18]);
    sealedBoxes.push(lid);
  }

  // D21 observes the original through its locked cover; the preservation kit contains tools only.
  const originalGuard = new THREE.Group();
  originalGuard.position.set(2.53, 0, -1.02);
  returnRoom.add(originalGuard);
  box(originalGuard, glass, [0, 0.92, 0], [1.58, 0.52, 0.9]);
  for (const x of [-0.79, 0.79])
    for (const z of [-0.45, 0.45])
      box(originalGuard, paint.brass, [x, 0.92, z], [0.025, 0.55, 0.025]);
  for (const z of [-0.46, 0.46])
    box(originalGuard, paint.brass, [0, 1.2, z], [1.62, 0.025, 0.025]);
  for (const x of [-0.8, 0.8])
    box(originalGuard, paint.brass, [x, 1.2, 0], [0.025, 0.025, 0.94]);
  box(originalGuard, paint.wood, [0, 0.91, 0.47], [0.13, 0.18, 0.035]);
  box(originalGuard, paint.brass, [0, 0.91, 0.495], [0.06, 0.08, 0.02]);

  // Moro: chamfered shell, recessed display, wheels, hinged gripper and receipt slip.
  const moro = new THREE.Group();
  moro.position.set(0.55, 0.05, 0.8);
  moro.rotation.y = -0.25;
  scene.add(moro);
  const torsoProfile = [
    new THREE.Vector2(0.24, 0),
    new THREE.Vector2(0.34, 0.05),
    new THREE.Vector2(0.35, 0.53),
    new THREE.Vector2(0.31, 0.68),
    new THREE.Vector2(0.22, 0.75),
    new THREE.Vector2(0, 0.75),
  ];
  solid(
    moro,
    geometry(new THREE.LatheGeometry(torsoProfile, 16)),
    paint.plaster,
    [0, 0.18, 0],
    [1, 1, 0.83]
  );
  for (const x of [-0.34, 0.34]) {
    cylinder(moro, paint.dark, [x, 0.19, 0], [0.19, 0.12, 0.19], [0, 0, Math.PI / 2]);
    cylinder(moro, paint.brass, [x * 1.19, 0.19, 0], [0.07, 0.015, 0.07], [0, 0, Math.PI / 2]);
  }
  box(moro, paint.dark, [0, 0.7, 0.262], [0.46, 0.23, 0.06]);
  const eyes = new THREE.Group();
  moro.add(eyes);
  for (const x of [-0.11, 0.11]) box(eyes, signal, [x, 0.72, 0.299], [0.055, 0.05, 0.012]);
  box(eyes, signal, [0, 0.64, 0.3], [0.09, 0.015, 0.01]);
  box(moro, paint.brass, [0, 0.43, 0.29], [0.2, 0.11, 0.02]);
  for (let i = 0; i < 3; i++)
    box(moro, paint.wood, [-0.06 + i * 0.06, 0.43, 0.31], [0.02, 0.06, 0.01]);
  beam(moro, paint.brass, [0.26, 0.52, 0.1], [0.51, 0.36, 0.28], 0.035);
  beam(moro, paint.wood, [0.51, 0.36, 0.28], [0.57, 0.51, 0.36], 0.023);
  beam(moro, paint.wood, [0.51, 0.36, 0.28], [0.68, 0.44, 0.36], 0.023);
  box(moro, paint.paper, [0.63, 0.39, 0.37], [0.13, 0.23, 0.015], [0.15, 0, -0.28]);
  const antenna = new THREE.Group();
  antenna.position.set(-0.16, 0.9, -0.05);
  moro.add(antenna);
  beam(antenna, paint.brass, [0, 0, 0], [0, 0.18, 0], 0.012);
  const antennaLight = sphere(antenna, signal, [0, 0.2, 0], [0.035, 0.035, 0.035]);
  cylinder(moro, contact, [0, -0.001, 0.04], [0.48, 0.008, 0.4]);
  const trolley = new THREE.Group();
  scene.add(trolley);
  box(trolley, paint.wood, [0, 0.08, 0], [1.04, 0.09, 0.75]);
  for (const x of [-0.42, 0.42])
    for (const z of [-0.27, 0.27])
      cylinder(trolley, paint.dark, [x, 0.03, z], [0.07, 0.06, 0.07], [0, 0, Math.PI / 2]);
  beam(trolley, paint.brass, [-0.5, 0.13, -0.32], [-0.5, 0.72, -0.5], 0.025);
  beam(trolley, paint.brass, [0.5, 0.13, -0.32], [0.5, 0.72, -0.5], 0.025);
  beam(trolley, paint.brass, [-0.5, 0.72, -0.5], [0.5, 0.72, -0.5], 0.025);

  // Yunseo's coat, spectacles and name badge distinguish the curator from the guide robot.
  const skin = material('#d9ad89');
  const hair = material('#392f30');
  const coat = material('#2e5555');
  const curator = new THREE.Group();
  curator.position.set(-2.1, 0.05, 0.85);
  curator.rotation.y = 0.55;
  scene.add(curator);
  const curatorBody = new THREE.Group();
  curatorBody.position.y = 1.03;
  curator.add(curatorBody);
  const coatProfile = [
    new THREE.Vector2(0.3, -0.4),
    new THREE.Vector2(0.34, -0.32),
    new THREE.Vector2(0.28, 0.44),
    new THREE.Vector2(0.21, 0.52),
    new THREE.Vector2(0, 0.52),
  ];
  solid(
    curatorBody,
    geometry(new THREE.LatheGeometry(coatProfile, 16)),
    coat,
    [0, 0, 0],
    [1, 1, 0.76]
  );
  box(curatorBody, paint.paper, [0, 0.33, 0.188], [0.16, 0.28, 0.03]);
  box(curatorBody, paint.brass, [0.14, 0.15, 0.228], [0.12, 0.075, 0.014]);
  box(curatorBody, paint.paper, [0.14, 0.15, 0.24], [0.075, 0.015, 0.006]);
  for (const y of [-0.2, 0, 0.2])
    sphere(curatorBody, paint.brass, [-0.025, y, 0.251], [0.018, 0.018, 0.009]);
  const curatorHead = new THREE.Group();
  curatorHead.position.y = 0.82;
  curatorBody.add(curatorHead);
  sphere(curatorHead, skin, [0, 0, 0], [0.22, 0.28, 0.19]);
  sphere(curatorHead, hair, [0, 0.2, -0.035], [0.24, 0.14, 0.21]);
  sphere(curatorHead, hair, [-0.19, 0.02, -0.07], [0.065, 0.24, 0.16]);
  sphere(curatorHead, hair, [0.19, 0.02, -0.07], [0.065, 0.24, 0.16]);
  sphere(curatorHead, skin, [0, -0.025, 0.19], [0.035, 0.06, 0.045]);
  const spectacle = geometry(new THREE.TorusGeometry(0.079, 0.012, 6, 16));
  for (const x of [-0.092, 0.092]) {
    solid(curatorHead, spectacle, paint.brass, [x, 0.035, 0.19], [1, 0.94, 1]);
    sphere(curatorHead, paint.dark, [x, 0.03, 0.18], [0.022, 0.026, 0.012]);
  }
  beam(curatorHead, paint.brass, [-0.025, 0.04, 0.22], [0.025, 0.04, 0.22], 0.009);
  beam(curatorHead, paint.rust, [-0.045, -0.12, 0.166], [0.045, -0.12, 0.166], 0.009);
  const curatorArms = [],
    curatorLegs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.3, 0.35, 0);
    curatorBody.add(arm);
    cylinder(arm, coat, [side * 0.03, -0.19, 0], [0.085, 0.38, 0.085]);
    cylinder(arm, paint.paper, [side * 0.03, -0.4, 0], [0.072, 0.07, 0.072]);
    sphere(arm, skin, [side * 0.03, -0.49, 0.025], [0.075, 0.105, 0.065]);
    arm.rotation.z = side * 0.13;
    curatorArms.push(arm);
    const leg = new THREE.Group();
    leg.position.set(side * 0.14, 0.68, 0);
    curator.add(leg);
    cylinder(leg, paint.dark, [0, -0.3, 0], [0.085, 0.6, 0.085]);
    sphere(leg, paint.wood, [0, -0.6, 0.075], [0.11, 0.07, 0.19]);
    curatorLegs.push(leg);
  }
  cylinder(curator, contact, [0, -0.003, 0.04], [0.45, 0.008, 0.35]);

  // Nara stays inside the message terminal: this is a remote portrait, never a room occupant.
  const terminal = new THREE.Group();
  terminal.position.set(0.35, 0.06, 1.25);
  terminal.rotation.y = 0.55;
  scene.add(terminal);
  const screenPaint = material('#698a7b', { emissive: '#587c6e', emissiveIntensity: 0.7 });
  box(terminal, paint.wood, [0, 0.4, 0], [0.78, 0.75, 0.55]);
  const screenPivot = new THREE.Group();
  screenPivot.position.set(0, 1.35, 0);
  terminal.add(screenPivot);
  box(screenPivot, paint.dark, [0, 0, 0], [0.83, 1.18, 0.1]);
  box(screenPivot, screenPaint, [0, 0, 0.06], [0.7, 1.03, 0.014]);
  const remotePortrait = new THREE.Group();
  screenPivot.add(remotePortrait);
  sphere(remotePortrait, paint.wood, [0, 0.2, 0.09], [0.17, 0.22, 0.025]);
  sphere(remotePortrait, skin, [0, 0.18, 0.12], [0.125, 0.16, 0.015]);
  sphere(remotePortrait, paint.wood, [-0.02, 0.31, 0.14], [0.15, 0.065, 0.014]);
  box(remotePortrait, paint.rust, [0, -0.05, 0.09], [0.34, 0.18, 0.02]);
  const messageDots = new THREE.Group();
  screenPivot.add(messageDots);
  for (let i = 0; i < 3; i++)
    sphere(messageDots, paint.paper, [-0.1 + i * 0.1, -0.29, 0.09], [0.025, 0.025, 0.008]);
  box(screenPivot, paint.paper, [0, -0.41, 0.09], [0.45, 0.015, 0.008]);
  cylinder(terminal, paint.brass, [0, 0.87, -0.04], [0.06, 0.35, 0.06]);

  const dustPositions = [];
  for (let i = 0; i < 22; i++)
    dustPositions.push(
      -1.6 + (i % 5) * 0.35,
      0.6 + ((i * 7) % 13) * 0.15,
      -0.8 + ((i * 3) % 7) * 0.25
    );
  const dustGeometry = geometry(new THREE.BufferGeometry());
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  const dustPaint = new THREE.PointsMaterial({
    color: '#ffe0a0',
    size: 0.021,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  materials.add(dustPaint);
  const dust = new THREE.Points(dustGeometry, dustPaint);
  scene.add(dust);

  // These fixtures hold the authored clues; observing them never grants an inventory item here.
  function inscription(lines, background, color, fontSize = 24) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) return paint.paper;
    context.fillStyle = background;
    context.fillRect(0, 0, 512, 256);
    context.fillStyle = color;
    context.textAlign = 'center';
    context.font = `500 ${fontSize}px sans-serif`;
    lines.forEach((line, index) =>
      context.fillText(line, 256, 48 + index * (170 / Math.max(1, lines.length - 1)))
    );
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    return material('#ffffff', { map: texture, roughness: 1 });
  }
  box(caseRoot, paint.brass, [-0.13, 1.55, 0.7], [0.09, 0.15, 0.04]);
  sphere(caseRoot, paint.dark, [-0.13, 1.55, 0.725], [0.012, 0.02, 0.007]);
  const exhibitLabel = inscription(['제1호', '아직 오지 않은 날'], '#b18a54', '#263b31', 30);
  solid(
    caseRoot,
    geometry(new THREE.PlaneGeometry(0.64, 0.22)),
    exhibitLabel,
    [-0.8, 0.81, 0.73],
    [1, 1, 1]
  );

  const noticeBoard = new THREE.Group();
  noticeBoard.position.set(1.15, 0.05, -2.2);
  noticeBoard.rotation.y = 0.2;
  scene.add(noticeBoard);
  for (const x of [-0.48, 0.48]) box(noticeBoard, paint.wood, [x, 0.65, 0], [0.08, 1.3, 0.08]);
  box(noticeBoard, paint.wood, [0, 1.5, 0], [1.35, 1.18, 0.09]);
  const schedule = inscription(
    ['내일 아침 9시', '이웃들과 배 띄우는 날', '밀봉 물품 개봉: 사흘 뒤', '전문 담당자 입회'],
    '#efe5c8',
    '#314b3f',
    26
  );
  const noticeFace = solid(
    noticeBoard,
    geometry(new THREE.PlaneGeometry(1.2, 1.03)),
    schedule,
    [0, 1.5, 0.052],
    [1, 1, 1]
  );
  const boardDiagram = new THREE.Group();
  noticeBoard.add(boardDiagram);
  for (const x of [-0.4, 0, 0.4])
    box(boardDiagram, paint.ink, [x, 1.55, 0.07], [0.18, 0.24, 0.015]);
  box(boardDiagram, paint.brass, [0, 1.2, 0.07], [0.9, 0.025, 0.015]);
  box(boardDiagram, paint.brass, [0, 1.82, 0.07], [0.9, 0.025, 0.015]);

  const valveStation = new THREE.Group();
  valveStation.position.set(-1.3, 0.05, 2.05);
  scene.add(valveStation);
  cylinder(valveStation, paint.wood, [0, 0.37, 0], [0.1, 0.74, 0.1]);
  beam(valveStation, paint.brass, [-0.35, 0.12, 0], [0.35, 0.12, 0], 0.09);
  const valveWheel = new THREE.Group();
  valveWheel.position.set(0, 0.8, 0.15);
  valveStation.add(valveWheel);
  solid(
    valveWheel,
    geometry(new THREE.TorusGeometry(0.26, 0.035, 6, 16)),
    paint.rust,
    [0, 0, 0],
    [1, 1, 1]
  );
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    beam(
      valveWheel,
      paint.rust,
      [0, 0, 0],
      [Math.cos(angle) * 0.24, Math.sin(angle) * 0.24, 0],
      0.022
    );
  }
  cylinder(valveWheel, paint.brass, [0, 0, 0], [0.055, 0.09, 0.055], [Math.PI / 2, 0, 0]);

  const supplies = new THREE.Group();
  supplies.position.set(-3.68, 0.06, 0.25);
  scene.add(supplies);
  box(supplies, paint.green, [0, 0.4, 0], [0.85, 0.8, 0.7]);
  box(supplies, paint.edge, [0, 0.85, 0], [0.91, 0.1, 0.75]);
  for (const y of [0.25, 0.52]) {
    box(supplies, paint.wood, [0, y, 0.36], [0.72, 0.21, 0.03]);
    box(supplies, paint.brass, [0, y, 0.39], [0.18, 0.025, 0.04]);
  }
  const batteryProp = new THREE.Group();
  batteryProp.position.set(0, 0.98, 0);
  supplies.add(batteryProp);
  box(batteryProp, paint.dark, [0, 0, 0], [0.5, 0.2, 0.3]);
  box(batteryProp, paint.brass, [0.18, 0.13, 0], [0.09, 0.06, 0.12]);
  box(batteryProp, paint.rust, [-0.18, 0.13, 0], [0.09, 0.06, 0.12]);
  box(batteryProp, paint.paper, [0, 0.01, 0.16], [0.18, 0.1, 0.014]);

  const archiveShelf = new THREE.Group();
  archiveShelf.position.set(-3.8, 0.08, -2.55);
  scene.add(archiveShelf);
  for (const x of [-0.4, 0.4]) box(archiveShelf, paint.wood, [x, 0.88, 0], [0.07, 1.76, 0.4]);
  for (const y of [0.1, 0.85, 1.6])
    box(archiveShelf, paint.wood, [0, y, 0], [0.86, 0.07, 0.44]);
  for (let i = 0; i < 7; i++)
    for (const y of [0.48, 1.23]) {
      box(
        archiveShelf,
        i % 2 ? paint.edge : paint.green,
        [-0.3 + i * 0.1, y, 0],
        [0.075, 0.58, 0.29]
      );
      box(archiveShelf, paint.paper, [-0.3 + i * 0.1, y + 0.12, 0.151], [0.045, 0.1, 0.01]);
    }

  const puzzleBoard = new THREE.Group();
  puzzleBoard.position.set(-2.9, 1.04, -1.3);
  scene.add(puzzleBoard);
  box(puzzleBoard, paint.edge, [0, 0, 0], [1.15, 0.06, 0.65]);
  for (let i = 0; i < 4; i++) {
    const x = (i % 2) * 0.48 - 0.24,
      z = Math.floor(i / 2) * 0.28 - 0.14;
    cylinder(puzzleBoard, paint.rust, [x, 0.09, z], [0.105, 0.12, 0.105]);
    cylinder(puzzleBoard, paint.wood, [x, 0.21, z], [0.055, 0.18, 0.055]);
  }
  const keyBundle = new THREE.Group();
  keyBundle.position.set(-2.58, 1.05, -1.2);
  keyBundle.rotation.y = 0.4;
  scene.add(keyBundle);
  solid(
    keyBundle,
    geometry(new THREE.TorusGeometry(0.08, 0.014, 6, 12)),
    paint.brass,
    [-0.12, 0.025, 0],
    [1, 1, 1],
    [Math.PI / 2, 0, 0]
  );
  for (const z of [-0.06, 0.06]) {
    box(keyBundle, paint.brass, [0.04, 0.025, z], [0.25, 0.025, 0.035]);
    box(keyBundle, paint.brass, [0.14, 0.025, z + 0.035], [0.045, 0.025, 0.1]);
  }
  const layeredLabel = new THREE.Group();
  layeredLabel.position.set(-2.9, 1.02, -1.3);
  scene.add(layeredLabel);
  box(layeredLabel, paint.paper, [0, 0, 0], [0.85, 0.025, 0.55]);
  const labelFlap = new THREE.Group();
  labelFlap.position.set(-0.4, 0.025, 0);
  layeredLabel.add(labelFlap);
  box(labelFlap, paint.green, [0.4, 0, 0], [0.8, 0.012, 0.5]);
  const controlPanel = new THREE.Group();
  controlPanel.position.set(0.9, 0.05, 1.65);
  controlPanel.rotation.y = 0.2;
  scene.add(controlPanel);
  box(controlPanel, paint.wood, [0, 0.48, 0], [0.8, 0.95, 0.56]);
  box(controlPanel, paint.green, [0, 1.04, 0], [0.94, 0.28, 0.7], [-0.16, 0, 0]);
  for (const x of [-0.22, 0.22])
    box(controlPanel, paint.dark, [x, 1.2, -0.08], [0.3, 0.035, 0.24]);
  for (let i = 0; i < 4; i++)
    cylinder(controlPanel, paint.brass, [-0.3 + i * 0.2, 1.2, 0.18], [0.045, 0.045, 0.045]);
  const craneIndicator = sphere(controlPanel, signal, [0.36, 1.23, -0.2], [0.04, 0.025, 0.04]);

  const returnControlPanel = controlPanel.clone(true);
  returnControlPanel.position.set(-0.2, 0.05, -13.7);
  scene.add(returnControlPanel);

  const packingTable = new THREE.Group();
  const packingTableFootprint = { width: 2.05, depth: 0.88 };
  packingTable.position.set(2.5, 0.06, 2.65);
  scene.add(packingTable);
  box(
    packingTable,
    paint.wood,
    [0, 0.73, 0],
    [packingTableFootprint.width, 0.1, packingTableFootprint.depth]
  );
  for (const x of [-0.85, 0.85])
    for (const z of [-0.32, 0.32])
      box(packingTable, paint.wood, [x, 0.35, z], [0.09, 0.7, 0.09]);
  box(packingTable, paint.paper, [0, 0.8, 0], [1.85, 0.025, 0.7]);

  const preservationKit = new THREE.Group();
  preservationKit.position.set(0, 0.82, 0);
  packingTable.add(preservationKit);
  box(preservationKit, paint.green, [-0.28, 0.15, 0], [0.9, 0.3, 0.58]);
  box(preservationKit, paint.edge, [-0.28, 0.32, 0], [0.94, 0.04, 0.62]);
  for (const x of [-0.55, 0])
    box(preservationKit, paint.brass, [x, 0.22, 0.3], [0.07, 0.12, 0.035]);
  cylinder(
    preservationKit,
    paint.paper,
    [0.55, 0.09, 0],
    [0.09, 0.45, 0.09],
    [Math.PI / 2, 0, 0]
  );
  box(preservationKit, paint.wood, [0.36, 0.04, 0.19], [0.045, 0.05, 0.3]);
  box(preservationKit, paint.brass, [0.36, 0.04, -0.03], [0.07, 0.025, 0.14]);

  const exitDoor = new THREE.Group();
  exitDoor.position.set(4.2, 0.05, 2.6);
  exitDoor.rotation.y = -0.5;
  scene.add(exitDoor);
  for (const x of [-0.55, 0.55]) box(exitDoor, paint.wood, [x, 1.15, 0], [0.1, 2.3, 0.16]);
  box(exitDoor, paint.wood, [0, 2.3, 0], [1.2, 0.14, 0.16]);
  box(exitDoor, paint.green, [-0.59, 1.1, -0.5], [0.08, 2.15, 1]);
  box(exitDoor, paint.brass, [-0.53, 1.05, -0.8], [0.08, 0.035, 0.14]);

  const maintenanceExit = exitDoor.clone(true);
  maintenanceExit.position.set(-12.2, 0.05, -13.4);
  scene.add(maintenanceExit);

  const trailPaint = material('#5b8984', {
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  for (let i = 0; i < 4; i++)
    for (const x of [0.3, 0.72])
      box(
        staticRoot,
        trailPaint,
        [x, 0.055, 0.4 - i * 0.24],
        [0.055, 0.006, 0.12],
        [0, -0.1, 0]
      );
  const selectionPaint = new THREE.LineBasicMaterial({
    color: '#f1cf86',
    transparent: true,
    opacity: 0.8,
    depthTest: false,
  });
  materials.add(selectionPaint);
  const selectionOutline = new THREE.LineSegments(
    geometry(new THREE.EdgesGeometry(unitBox)),
    selectionPaint
  );
  selectionOutline.visible = false;
  selectionOutline.renderOrder = 5;
  scene.add(selectionOutline);

  // Geometry and collision share the same room and corridor rectangles.
  const rooms = {};
  const roomColors = {
    gallery: paint.tile,
    maintenance: paint.dark,
    archive: paint.edge,
    garden: paint.green,
    office: paint.wood,
    return: paint.ink,
    control: paint.dark,
    foyer: paint.plaster,
    reception: paint.edge,
  };
  for (const room of ROOMS) {
    const group = new THREE.Group();
    group.position.set(room.x, 0, room.z);
    rooms[room.id] = group;
    scene.add(group);
    box(group, roomColors[room.id], [0, -0.14, 0], [room.width, 0.24, room.depth]);
    const linked = CONNECTIONS.filter((pair) => pair.includes(room.id)).map((pair) =>
      ROOMS.find((other) => other.id === pair.find((id) => id !== room.id))
    );
    for (const side of ['north', 'south', 'west', 'east']) {
      const horizontal = side === 'north' || side === 'south';
      const sign = side === 'north' || side === 'west' ? -1 : 1;
      const length = horizontal ? room.width : room.depth;
      const doorway = linked.some((other) =>
        horizontal
          ? other.x === room.x && Math.sign(other.z - room.z) === sign
          : other.z === room.z && Math.sign(other.x - room.x) === sign
      );
      const wallHeight = side === 'north' ? 1.5 : 0.65;
      const pieces = doorway
        ? [
            [-(length + 3.6) / 4, (length - 3.6) / 2],
            [(length + 3.6) / 4, (length - 3.6) / 2],
          ]
        : [[0, length]];
      for (const [center, span] of pieces) {
        const pos = horizontal
          ? [center, wallHeight / 2, (sign * room.depth) / 2]
          : [(sign * room.width) / 2, wallHeight / 2, center];
        const size = horizontal ? [span, wallHeight, 0.18] : [0.18, wallHeight, span];
        box(group, room.id === 'garden' ? paint.wood : paint.plaster, pos, size);
        box(
          group,
          paint.brass,
          [pos[0], wallHeight + 0.025, pos[2]],
          [size[0] + 0.04, 0.05, size[2] + 0.04]
        );
      }
      if (doorway) {
        const boundary = (sign * (horizontal ? room.depth : room.width)) / 2;
        box(
          group,
          paint.brass,
          horizontal ? [0, 0.015, boundary] : [boundary, 0.015, 0],
          horizontal ? [3.5, 0.025, 0.18] : [0.18, 0.025, 3.5]
        );
        // Posts sit outside the shared 3.6-unit passage; the walking footprint stays unchanged.
        for (const edge of [-1.94, 1.94]) {
          box(
            group,
            paint.dark,
            horizontal ? [edge, 1.05, boundary] : [boundary, 1.05, edge],
            horizontal ? [0.22, 2.1, 0.3] : [0.3, 2.1, 0.22]
          );
          box(
            group,
            paint.brass,
            horizontal ? [edge, 0.22, boundary] : [boundary, 0.22, edge],
            [0.32, 0.44, 0.32]
          );
        }
        box(
          group,
          paint.dark,
          horizontal ? [0, 2.14, boundary] : [boundary, 2.14, 0],
          horizontal ? [4.1, 0.12, 0.28] : [0.28, 0.12, 4.1]
        );
        box(
          group,
          roomColors[room.id],
          horizontal ? [0, 2.17, boundary] : [boundary, 2.17, 0],
          horizontal ? [0.6, 0.16, 0.31] : [0.31, 0.16, 0.6]
        );
      }
    }
    const roomLabel = inscription([room.label], '#29443f', '#f0e4bd', 42);
    solid(
      group,
      geometry(new THREE.PlaneGeometry(3.2, 1.6)),
      roomLabel,
      [0, 0.025, 3.8],
      [1, 1, 1],
      [-Math.PI / 2, 0, 0]
    );
    if (room.id !== 'garden')
      for (let x = -5; x <= 5; x++) box(group, paint.fold, [x, 0.001, 0], [0.012, 0.008, 9.8]);
  }
  const corridors = new THREE.Group();
  scene.add(corridors);
  for (const corridor of CORRIDORS) {
    box(
      corridors,
      paint.ink,
      [corridor.x, -0.17, corridor.z],
      [corridor.width, 0.18, corridor.depth]
    );
    const horizontal = corridor.width > corridor.depth;
    const span = horizontal ? 4 : 6;
    for (const side of [-1, 1])
      box(
        corridors,
        paint.edge,
        horizontal
          ? [corridor.x, 0.25, corridor.z + side * 1.8]
          : [corridor.x + side * 1.8, 0.25, corridor.z],
        horizontal ? [span, 0.5, 0.15] : [0.15, 0.5, span]
      );
    for (const side of [-1, 1])
      box(
        corridors,
        signal,
        horizontal
          ? [corridor.x, 0.01, corridor.z + side * 1.5]
          : [corridor.x + side * 1.5, 0.01, corridor.z],
        horizontal ? [span, 0.02, 0.025] : [0.025, 0.02, span]
      );
  }
  // The permanent sets remain visible when the story moves to another room.
  staticRoot.position.set(0, 0, 0);
  for (const x of [-4, -2, 2, 4]) {
    solid(rooms.gallery, arch(1.1, 1.8), windowGlass, [x, 0.18, -4.88], [1, 1, 1]);
    box(rooms.gallery, paint.brass, [x, 0.24, -4.8], [1.2, 0.08, 0.2]);
  }
  archiveDesk.position.set(-16, 0, 0);
  gardenRoot.position.set(-16, 0, 16);
  returnRoom.position.set(0, 0, -16);
  archiveShelf.position.set(-20.5, 0.08, -3.3);
  puzzleBoard.position.set(-18.9, 1.04, -1.3);
  layeredLabel.position.set(-18.9, 1.02, -1.3);
  keyBundle.position.set(13.42, 1.05, -1.2);
  valveStation.position.set(-17.3, 0.05, 18.05);
  controlPanel.position.set(16.9, 0.05, -14.35);
  exitDoor.position.set(4.2, 0.05, 18.6);
  for (const x of [-4, -2, 2, 4]) {
    box(rooms.archive, paint.wood, [x, 1.1, -3.9], [1.35, 2.2, 0.6]);
    for (const y of [0.35, 1, 1.65])
      for (let i = 0; i < 7; i++)
        box(
          rooms.archive,
          i % 2 ? paint.green : paint.fold,
          [x - 0.5 + i * 0.16, y, -3.55],
          [0.12, 0.5, 0.18]
        );
  }
  for (const z of [-3, -1, 1, 3])
    for (const x of [-4, 4]) {
      cylinder(rooms.maintenance, paint.brass, [x, 1.3, z], [0.08, 2.6, 0.08]);
      box(rooms.maintenance, signal, [x, 2.5, z], [0.3, 0.06, 0.2]);
    }
  box(rooms.maintenance, paint.green, [0, 0.6, -3.5], [3.5, 1.2, 0.8]);
  for (let x = -5; x <= 5; x++)
    for (let z = -4; z <= 4; z++)
      if ((x + z) % 2 === 0) box(rooms.garden, paint.edge, [x, 0.005, z], [0.9, 0.02, 0.9]);
  box(rooms.garden, waterPaint, [1, 0.025, 0], [0.35, 0.02, 7.3]);
  box(rooms.office, paint.rust, [0, 0.015, 1], [4, 0.025, 2.4]);
  box(rooms.office, paint.wood, [-2.9, 0.87, -1.35], [1.8, 0.14, 1]);
  for (const x of [-3.6, -2.2])
    for (const z of [-1.7, -1]) box(rooms.office, paint.wood, [x, 0.43, z], [0.12, 0.8, 0.12]);
  box(rooms.office, paint.green, [2, 1, -3.7], [2.5, 2, 0.5]);
  box(rooms.control, paint.edge, [0, 0.02, 2.5], [8, 0.03, 0.8]);
  for (const x of [-4, 4]) {
    cylinder(rooms.control, paint.green, [x, 1.4, -3.4], [0.3, 2.8, 0.3]);
    box(rooms.control, signal, [x, 2.85, -3.4], [0.4, 0.05, 0.4]);
  }
  box(rooms.reception, paint.green, [-1.7, 0.65, -2.6], [4.5, 1.3, 0.85]);
  box(rooms.reception, paint.paper, [-1.7, 1.34, -2.6], [4.65, 0.09, 0.95]);
  for (const x of [-4, 4]) box(rooms.foyer, paint.wood, [x, 0.45, 0], [1.4, 0.15, 2.5]);
  box(rooms.foyer, paint.green, [0, 0.02, 0], [4, 0.03, 4]);
  const mapDesk = new THREE.Group();
  mapDesk.position.set(0, 0.05, 14.2);
  scene.add(mapDesk);
  box(mapDesk, paint.wood, [0, 0.65, 0], [1.8, 1.3, 0.7]);
  solid(
    mapDesk,
    geometry(new THREE.PlaneGeometry(1.6, 0.85)),
    inscription(
      ['박물관 안내', '정비 · 반환 · 인양', '기록 · 전시 · 관장', '안뜰 · 로비 · 접수'],
      '#e4dfc8',
      '#29443f',
      28
    ),
    [0, 1.4, 0.36],
    [1, 1, 1]
  );
  cylinder(
    rooms.office,
    paint.brass,
    [3.6, 1.2, -3.4],
    [0.38, 0.08, 0.38],
    [Math.PI / 2, 0, 0]
  );
  cylinder(
    rooms.office,
    paint.paper,
    [3.6, 1.2, -3.34],
    [0.32, 0.025, 0.32],
    [Math.PI / 2, 0, 0]
  );
  box(rooms.office, paint.wood, [3.6, 1.3, -3.31], [0.025, 0.21, 0.02]);
  box(rooms.office, paint.wood, [3.71, 1.2, -3.31], [0.23, 0.025, 0.02]);
  for (const x of [-0.55, 0, 0.55]) {
    box(rooms.maintenance, paint.edge, [x, 1.35, -3.95], [0.1, 0.65, 0.07]);
    cylinder(
      rooms.maintenance,
      paint.brass,
      [x, 1.73, -3.9],
      [0.14, 0.035, 0.14],
      [Math.PI / 2, 0, 0]
    );
  }
  for (const x of [-2.7, -1.4, -0.1]) {
    box(rooms.reception, paint.wood, [x, 1.45, -2.6], [0.8, 0.12, 0.55]);
    box(rooms.reception, paint.paper, [x, 1.52, -2.6], [0.68, 0.025, 0.43]);
  }

  const invitation = new THREE.Group();
  invitation.position.set(0, 1.42, 0.41);
  mapDesk.add(invitation);
  box(invitation, paint.paper, [0, 0, 0], [1.46, 0.72, 0.035]);
  solid(
    invitation,
    geometry(new THREE.PlaneGeometry(1.4, 0.66)),
    inscription(['야간 관람 초대장', '관장 윤서가 기다립니다'], '#f5ecd4', '#29443f', 32),
    [0, 0, 0.021],
    [1, 1, 1]
  );
  cylinder(
    invitation,
    paint.rust,
    [0.57, -0.22, 0.045],
    [0.07, 0.018, 0.07],
    [Math.PI / 2, 0, 0]
  );

  const player = new THREE.Group();
  scene.add(player);
  const playerCoat = material('#cf774d');
  sphere(player, contact, [0, 0.025, 0], [0.36, 0.025, 0.3]);
  sphere(player, playerCoat, [0, 0.68, 0], [0.28, 0.4, 0.23]);
  sphere(player, paint.paper, [0, 1.12, 0.01], [0.22, 0.23, 0.21]);
  sphere(player, paint.wood, [0, 1.23, -0.04], [0.23, 0.15, 0.2]);
  box(player, paint.brass, [0, 0.82, 0.225], [0.12, 0.1, 0.025]);
  box(player, paint.dark, [0, 0.7, -0.24], [0.3, 0.38, 0.15]);
  const playerLegs = [];
  for (const x of [-0.13, 0.13]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.4, 0);
    player.add(leg);
    playerLegs.push(leg);
    box(leg, paint.dark, [0, -0.17, 0], [0.16, 0.34, 0.18]);
    box(leg, paint.wood, [0, -0.35, 0.05], [0.18, 0.12, 0.27]);
  }
  const beacon = new THREE.Group();
  scene.add(beacon);
  const beaconRing = solid(
    beacon,
    geometry(new THREE.TorusGeometry(0.7, 0.055, 6, 24)),
    signal,
    [0, 0.08, 0],
    [1, 1, 1],
    [Math.PI / 2, 0, 0]
  );
  const beaconArrow = solid(
    beacon,
    geometry(new THREE.ConeGeometry(0.22, 0.5, 4)),
    signal,
    [0, 0.8, 0],
    [1, 1, 1],
    [Math.PI, 0, 0]
  );

  const floorShadows = new THREE.Group();
  scene.add(floorShadows);
  const shadowDisc = geometry(new THREE.CircleGeometry(1, 24));
  for (const [x, z, w, d] of [
    [-0.8, 0.1, 2.1, 1.55],
    [-18.9, -1.35, 2.1, 1.25],
    [13.1, -1.35, 2.1, 1.25],
    [2.55, -15.9, 3.3, 4.15],
    [14.3, 13.4, 4.9, 1.2],
    [0, 14.2, 2.1, 1],
    [-18.5, 18.32, 3.4, 1.8],
  ])
    solid(
      floorShadows,
      shadowDisc,
      contact,
      [x, 0.012, z],
      [w / 2, d / 2, 1],
      [-Math.PI / 2, 0, 0]
    );
  for (const [group, w, d] of [
    [packingTable, 2.3, 1.1],
    [terminal, 1.05, 0.75],
    [supplies, 1.05, 0.9],
  ])
    solid(group, shadowDisc, contact, [0, -0.045, 0], [w / 2, d / 2, 1], [-Math.PI / 2, 0, 0]);

  // Major surfaces share one thin edge draw per group; tiny parts and transparent glass stay unoutlined.
  const inkEdges = new THREE.LineBasicMaterial({
    color: '#233c35',
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  materials.add(inkEdges);
  const edgeCache = new Map();
  function outlineMajorSurfaces(group) {
    const positions = [];
    const vertex = new THREE.Vector3();
    for (const object of group.children) {
      if (!object.isMesh || Array.isArray(object.material) || object.material.transparent)
        continue;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const dimensions = object.geometry.boundingBox
        .getSize(new THREE.Vector3())
        .multiply(object.scale)
        .toArray()
        .map(Math.abs)
        .sort((a, b) => b - a);
      if (dimensions[0] < 0.6 || dimensions[1] < 0.3) continue;
      if (!edgeCache.has(object.geometry))
        edgeCache.set(object.geometry, geometry(new THREE.EdgesGeometry(object.geometry, 35)));
      const edges = edgeCache.get(object.geometry).attributes.position;
      object.updateMatrix();
      for (let i = 0; i < edges.count; i++) {
        vertex.fromBufferAttribute(edges, i).applyMatrix4(object.matrix);
        positions.push(vertex.x, vertex.y, vertex.z);
      }
    }
    if (!positions.length) return;
    const shape = geometry(new THREE.BufferGeometry());
    shape.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    group.add(new THREE.LineSegments(shape, inkEdges));
  }
  for (const group of [
    ...Object.values(rooms),
    caseRoot,
    archiveDesk,
    returnRoom,
    packingTable,
    controlPanel,
    returnControlPanel,
    supplies,
    terminal,
    screenPivot,
    noticeBoard,
    preservationKit,
  ])
    outlineMajorSurfaces(group);

  // Repeated model pieces share instances; animated/stateful groups keep local ownership.
  function batch(group) {
    group.updateMatrixWorld(true);
    const buckets = new Map();
    group.traverse((object) => {
      if (!object.isMesh || object.parent !== group || Array.isArray(object.material)) return;
      const key = `${object.geometry.uuid}:${object.material.uuid}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(object);
    });
    const inverse = group.matrixWorld.clone().invert();
    for (const meshes of buckets.values()) {
      if (meshes.length < 2) continue;
      const instances = new THREE.InstancedMesh(
        meshes[0].geometry,
        meshes[0].material,
        meshes.length
      );
      meshes.forEach((mesh, index) => {
        instances.setMatrixAt(index, inverse.clone().multiply(mesh.matrixWorld));
        mesh.removeFromParent();
      });
      instances.instanceMatrix.needsUpdate = true;
      instances.computeBoundingSphere();
      group.add(instances);
    }
  }
  batch(floorShadows);
  batch(originalGuard);
  batch(preservationKit);
  batch(staticRoot);
  batch(caseRoot);
  batch(archiveDesk);
  batch(gardenRoot);
  for (const room of Object.values(rooms)) batch(room);
  batch(corridors);
  batch(player);
  batch(mapDesk);
  // Only direct children are batched; nested state variants keep independent visibility.
  batch(returnRoom);
  for (const group of [
    moro,
    ledger,
    blurredLedger,
    ...sealedBoxes,
    trolley,
    curator,
    curatorBody,
    curatorHead,
    ...curatorArms,
    ...curatorLegs,
    terminal,
    screenPivot,
    messageDots,
    remotePortrait,
    noticeBoard,
    boardDiagram,
    valveStation,
    valveWheel,
    supplies,
    batteryProp,
    archiveShelf,
    puzzleBoard,
    keyBundle,
    layeredLabel,
    labelFlap,
    controlPanel,
    returnControlPanel,
    packingTable,
    exitDoor,
    maintenanceExit,
  ])
    batch(group);
  remotePortrait.name = 'remote-portrait';
  screenPivot.name = 'remote-screen';
  messageDots.name = 'message-dots';
  batteryProp.name = 'unique-battery';
  noticeFace.name = 'board-face';
  boardDiagram.name = 'board-diagram';
  const roomTerminals = { reception: terminal };
  terminal.position.set(14, 0.06, 15.1);
  for (const id of ['maintenance', 'archive', 'garden', 'return', 'foyer']) {
    const room = ROOMS.find((item) => item.id === id),
      fixture = terminal.clone(true);
    fixture.position.set(room.x - 2, 0.06, room.z - 2.3);
    fixture.getObjectByName('remote-portrait').visible = false;
    roomTerminals[id] = fixture;
    scene.add(fixture);
  }
  const roomRemoteDisplays = Object.fromEntries(
    Object.entries(roomTerminals).map(([id, fixture]) => [
      id,
      {
        screen: fixture.getObjectByName('remote-screen'),
        portrait: fixture.getObjectByName('remote-portrait'),
        dots: fixture.getObjectByName('message-dots'),
      },
    ])
  );
  const roomBoards = { gallery: noticeBoard };
  noticeBoard.position.set(2, 0.05, -2.6);
  noticeFace.material = schedule;
  boardDiagram.visible = false;
  for (const id of ['archive', 'garden', 'office']) {
    const room = ROOMS.find((item) => item.id === id),
      fixture = noticeBoard.clone(true);
    fixture.position.set(room.x + 2, 0.05, room.z - 2.6);
    fixture.getObjectByName('board-face').material = paint.paper;
    fixture.getObjectByName('board-diagram').visible = true;
    roomBoards[id] = fixture;
    scene.add(fixture);
  }
  const roomSupplies = { maintenance: supplies };
  supplies.position.set(-12.2, 0.06, -14.8);
  for (const id of ['garden', 'return']) {
    const room = ROOMS.find((item) => item.id === id),
      fixture = supplies.clone(true);
    fixture.position.set(room.x + (id === 'return' ? 4.6 : 3.8), 0.06, room.z + 1.2);
    fixture.getObjectByName('unique-battery').visible = false;
    roomSupplies[id] = fixture;
    scene.add(fixture);
  }
  preservationKit.name = 'preservation-kit';
  const roomPackingTables = { return: packingTable };
  packingTable.position.set(2.5, 0.06, -13.35);
  for (const id of ['reception', 'archive', 'maintenance', 'foyer']) {
    const room = ROOMS.find((item) => item.id === id),
      fixture = packingTable.clone(true);
    fixture.position.set(room.x + 2.5, 0.06, room.z + 2.65);
    fixture.getObjectByName('preservation-kit').visible = false;
    roomPackingTables[id] = fixture;
    scene.add(fixture);
  }
  const actors = [
    {
      id: 'yunseo',
      object: curator,
      initialized: false,
      destination: null,
      path: [],
      moving: false,
      waitForPlayer: false,
    },
    {
      id: 'moro',
      object: moro,
      initialized: false,
      destination: null,
      path: [],
      moving: false,
      waitForPlayer: false,
    },
  ];

  const hemisphere = new THREE.HemisphereLight('#8ba8bd', '#253d37', 0.9);
  const key = new THREE.DirectionalLight('#ffce8a', 1.45);
  key.position.set(-4, 9, 6);
  const fill = new THREE.DirectionalLight('#93b5d8', 0.7);
  fill.position.set(6, 5, -2);
  const exhibitLight = new THREE.SpotLight('#ffd399', 22, 10, 0.53, 0.65, 1.4);
  exhibitLight.position.set(-1.4, 5, 1);
  exhibitLight.target.position.set(-0.8, 0.9, 0.1);
  const deskLight = new THREE.SpotLight('#f9c283', 14, 9, 0.54, 0.6, 1.4);
  deskLight.position.set(-3.1, 4, -1.3);
  deskLight.target.position.set(-2.8, 0.8, -1.3);
  scene.add(
    hemisphere,
    key,
    fill,
    exhibitLight,
    exhibitLight.target,
    deskLight,
    deskLight.target
  );

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const target = new THREE.Vector3(-0.45, 0.85, 0.15);
  const cameraTarget = target.clone();
  const cameraFrom = new THREE.Vector3(10, 9, 12);
  const cameraTo = cameraFrom.clone();
  const targetFrom = target.clone();
  let frame = null,
    startTime = null,
    disposed = false,
    contextLost = false,
    moving = false;
  let width = 1,
    height = 1,
    lastVisualState = '',
    renderedFrames = 0;
  let lastMessage = null,
    gestureStart = null,
    speaking = null,
    lastRenderedAt = 0;
  const projectedSpeaker = new THREE.Vector3();
  let zoomFrom = 1,
    zoomTo = 1;
  let userZoom = 1,
    cameraYaw = 35,
    cameraPitch = 43,
    lastCameraSettings = '',
    manualCamera = false;
  const cameraOffset = new THREE.Vector3();
  let fallbackCaption = null;
  let activeAnchor = null,
    hoveredAnchor = null;
  let excludedRects = [],
    hotspotLayout = [];
  let spawned = false,
    lastArrival = null,
    lastStepAt = null,
    lastNavigationAt = 0,
    lastNavigation = '';
  let walkPath = [],
    pendingInspect = null,
    avatarMoving = false;
  const pressed = new Set();
  camera.position.copy(cameraTo);
  camera.lookAt(target);

  function anchorShape(anchor) {
    const from = (object, offset, size) => ({
      point: object.localToWorld(new THREE.Vector3(...offset)),
      size,
    });
    if (anchor === 'invitation') return from(invitation, [0, 0, 0], [1.46, 0.72, 0.08]);
    if (anchor === 'case') return from(caseRoot, [-0.8, 1.2, 0.1], [1.8, 2.15, 1.4]);
    if (anchor === 'moro') return from(moro, [0, 0.6, 0], [0.9, 1.18, 0.85]);
    if (anchor === 'yunseo') return from(curator, [0, 1.1, 0], [0.9, 2.2, 0.8]);
    if (anchor === 'desk') {
      if (current.sceneId === 'D21')
        return from(preservationKit, [0, 0.18, 0], [1.5, 0.4, 0.7]);
      if (current.currentRoomId === 'office')
        return { point: new THREE.Vector3(13.1, 0.95, -1.3), size: [1.8, 0.3, 1] };
      if (['reception', 'return'].includes(current.currentRoomId))
        return from(
          roomPackingTables[current.currentRoomId] ?? packingTable,
          [0, 0.8, 0],
          [2.1, 0.28, 0.9]
        );
      return from(archiveDesk, [-2.9, 0.95, -1.3], [1.7, 0.25, 0.85]);
    }
    if ((anchor === 'terminal' || anchor === 'board') && current.sceneId === 'P11')
      return from(puzzleBoard, [0, 0.12, 0], [1.2, 0.3, 0.7]);
    if (anchor === 'terminal' && current.sceneId === 'P21')
      return from(controlPanel, [0, 1.05, 0], [1, 0.4, 0.75]);
    if (anchor === 'terminal')
      return from(
        roomTerminals[current.currentRoomId] ?? terminal,
        [0, 1.35, 0],
        [0.95, 1.3, 0.3]
      );
    if (anchor === 'board' && current.currentRoomId === 'foyer')
      return from(mapDesk, [0, 1.4, 0], [1.8, 1.5, 0.7]);
    if (anchor === 'board')
      return from(
        roomBoards[current.currentRoomId] ?? noticeBoard,
        [0, 1.5, 0],
        [1.4, 1.2, 0.14]
      );
    if (anchor === 'valve') {
      if (current.currentRoomId === 'return')
        return from(returnControlPanel, [0, 1.05, 0], [1, 0.4, 0.75]);
      return current.currentRoomId === 'control'
        ? from(controlPanel, [0, 1.05, 0], [1, 0.4, 0.75])
        : from(valveStation, [0, 0.8, 0.15], [0.65, 0.7, 0.4]);
    }
    if (anchor === 'boat') {
      if (current.currentRoomId !== 'return' && current.flags.boat === 'sealed')
        return from(
          roomPackingTables[current.currentRoomId] ?? packingTable,
          [0, 0.8, 0],
          [2.1, 0.28, 0.9]
        );
      return from(
        current.flags.boat === 'sealed'
          ? sealedBoxes[0]
          : current.flags.boat === 'damaged'
          ? damagedBoat
          : boat,
        [0, 0.2, 0],
        [1.8, 0.6, 0.8]
      );
    }
    if (anchor === 'ledger') {
      if (current.sceneId === 'D21') return from(originalGuard, [0, 0.92, 0], [1.65, 0.6, 1]);
      if (current.currentRoomId === 'archive')
        return from(archiveDesk, [-2.58, 1.03, -1.2], [0.6, 0.18, 0.45]);
      if (current.currentRoomId !== 'return' && current.flags.record !== 'intact')
        return from(
          roomPackingTables[current.currentRoomId] ?? packingTable,
          [0.55, 0.8, 0],
          [0.9, 0.18, 0.7]
        );
      return from(
        current.flags.record === 'sealed'
          ? sealedBoxes[1]
          : current.flags.record === 'unreadable'
          ? blurredLedger
          : ledger,
        [0, 0.1, 0],
        [1.75, 0.5, 1.05]
      );
    }
    if (anchor === 'battery')
      return from(
        roomSupplies[current.currentRoomId] ?? supplies,
        [0, 1, 0],
        [0.65, 0.38, 0.45]
      );
    if (anchor === 'exit')
      return from(
        current.currentRoomId === 'maintenance' ? maintenanceExit : exitDoor,
        [0, 1.15, 0],
        [1.25, 2.4, 0.3]
      );
    return null;
  }

  function refreshExclusions() {
    const origin = element.getBoundingClientRect();
    excludedRects = [
      ...document.querySelectorAll(
        '.masthead, .scene-heading, .dialogue-shell, .investigation-dock, .investigation-panel, #notice'
      ),
    ]
      .filter((node) => node.getClientRects().length)
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left - origin.left - 10,
          right: rect.right - origin.left + 10,
          top: rect.top - origin.top - 10,
          bottom: rect.bottom - origin.top + 10,
        };
      });
  }

  function syncHotspots() {
    const liveIds = new Set(current.hotspots.map((hotspot) => hotspot.id));
    for (const [id, entry] of hotspotButtons)
      if (!liveIds.has(id)) {
        entry.button.remove();
        hotspotButtons.delete(id);
      }
    for (const hotspot of current.hotspots) {
      if (!anchorShape(hotspot.anchor)) continue;
      let entry = hotspotButtons.get(hotspot.id);
      if (!entry) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.hotspotId = hotspot.id;
        Object.assign(button.style, {
          position: 'absolute',
          left: '0',
          top: '0',
          pointerEvents: 'auto',
          minHeight: '44px',
          maxWidth: '224px',
          padding: '9px 13px',
          borderRadius: '3px',
          border: '1px solid #e4c88e',
          background: '#173a32f0',
          color: '#fff1d1',
          fontSize: '13px',
          lineHeight: '1.4',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          cursor: 'pointer',
          boxShadow: '0 4px 16px #071d1855',
          touchAction: 'manipulation',
        });
        button.addEventListener('click', () => {
          const live = current.hotspots.find((item) => item.id === hotspot.id);
          if (!current.interactive || !live || width < 700) return;
          approach(live.id);
        });
        const highlight = () => {
          hoveredAnchor =
            current.hotspots.find((item) => item.id === hotspot.id)?.anchor ?? null;
          render();
        };
        const clear = () => {
          hoveredAnchor = null;
          render();
        };
        button.addEventListener('pointerenter', highlight);
        button.addEventListener('pointerleave', clear);
        button.addEventListener('focus', () => {
          button.style.outline = '3px solid #fff1d1';
          button.style.outlineOffset = '3px';
          highlight();
        });
        button.addEventListener('blur', () => {
          button.style.outline = '';
          clear();
        });
        hotspotLayer.append(button);
        entry = { button, width: 170, height: 44 };
        hotspotButtons.set(hotspot.id, entry);
      }
      const title = `${hotspot.visited ? '✓ ' : '◇ '}${hotspot.label}`;
      if (entry.button.textContent !== title) entry.button.textContent = title;
      entry.button.setAttribute(
        'aria-label',
        `${hotspot.label}${hotspot.visited ? ', 확인함' : ', 조사하기'}`
      );
      entry.button.dataset.anchor = hotspot.anchor;
      entry.button.dataset.kind = hotspot.kind ?? 'inspect';
      entry.button.disabled = !current.interactive;
      entry.button.style.borderColor = hotspot.visited ? '#92ac91' : '#e4c88e';
      entry.width = Math.min(224, Math.max(94, hotspot.label.length * 13 + 48));
      entry.button.style.width = `${entry.width}px`;
    }
    refreshExclusions();
  }

  function placeHotspots() {
    hotspotLayout = [];
    const show = current.interactive && width >= 700 && !contextLost;
    hotspotLayer.hidden = !show;
    if (!show) return;
    const occupied = [...excludedRects];
    for (const hotspot of current.hotspots) {
      const entry = hotspotButtons.get(hotspot.id),
        shape = anchorShape(hotspot.anchor);
      if (!entry || !shape) continue;
      shape.point.y += Math.min(0.5, shape.size[1] * 0.4);
      const point = shape.point.project(camera);
      const projectedX = ((point.x + 1) * width) / 2,
        projectedY = ((1 - point.y) * height) / 2;
      const candidates = [
        [0, -54],
        [0, 18],
        [130, -20],
        [-130, -20],
        [0, 76],
        [150, 52],
        [-150, 52],
        [0, -110],
      ];
      let chosen = null;
      for (const [dx, dy] of candidates) {
        const x = Math.max(
          16,
          Math.min(width - entry.width - 16, projectedX - entry.width / 2 + dx)
        );
        const y = Math.max(86, Math.min(height * 0.74 - entry.height, projectedY + dy));
        const rect = { left: x, right: x + entry.width, top: y, bottom: y + entry.height };
        if (
          occupied.some(
            (other) =>
              rect.left < other.right &&
              rect.right > other.left &&
              rect.top < other.bottom &&
              rect.bottom > other.top
          )
        )
          continue;
        chosen = rect;
        break;
      }
      entry.button.hidden = !chosen;
      if (!chosen) {
        hotspotLayout.push({ id: hotspot.id, anchor: hotspot.anchor, visible: false });
        continue;
      }
      entry.button.style.transform = `translate3d(${chosen.left}px,${chosen.top}px,0)`;
      occupied.push({
        left: chosen.left - 6,
        right: chosen.right + 6,
        top: chosen.top - 6,
        bottom: chosen.bottom + 6,
      });
      hotspotLayout.push({
        id: hotspot.id,
        anchor: hotspot.anchor,
        visible: true,
        x: chosen.left,
        y: chosen.top,
        width: entry.width,
        height: entry.height,
      });
    }
  }

  function showSelection() {
    const shape = anchorShape(activeAnchor ?? hoveredAnchor);
    selectionOutline.visible = Boolean(shape);
    if (!shape) return;
    selectionOutline.position.copy(shape.point);
    selectionOutline.scale.set(...shape.size);
  }

  function composeCamera(baseZoom, distance) {
    const yaw = THREE.MathUtils.degToRad(cameraYaw),
      pitch = THREE.MathUtils.degToRad(cameraPitch);
    cameraOffset.set(
      Math.sin(yaw) * Math.cos(pitch) * distance,
      Math.sin(pitch) * distance,
      Math.cos(yaw) * Math.cos(pitch) * distance
    );
    cameraTo.copy(cameraTarget).add(cameraOffset);
    zoomTo = Math.min(4, baseZoom * userZoom);
    const settings = { zoom: userZoom, pitch: cameraPitch, yaw: cameraYaw };
    const signature = JSON.stringify(settings);
    if (signature !== lastCameraSettings) {
      lastCameraSettings = signature;
      onCameraChange(settings);
    }
  }
  function aimAtAnchor(anchor) {
    const shape = anchorShape(anchor);
    if (!shape) return false;
    cameraTarget.copy(shape.point);
    // Keep the inspected object above the lower dialogue panel while retaining its height.
    cameraTarget.y -= 0.8;
    const documentAnchor = [
      'invitation',
      'desk',
      'ledger',
      'board',
      'terminal',
      'battery',
    ].includes(anchor);
    const baseZoom =
      width < 700
        ? documentAnchor
          ? 1.9
          : 1.65
        : anchor === 'case'
        ? 2.3
        : documentAnchor
        ? 2.8
        : 2.6;
    composeCamera(baseZoom, 13.45);
    return true;
  }
  function focus(anchor) {
    if (disposed || contextLost || !anchorShape(anchor)) return false;
    activeAnchor = anchor;
    manualCamera = false;
    cameraFrom.copy(camera.position);
    targetFrom.copy(target);
    zoomFrom = camera.zoom;
    startTime = null;
    aimAtAnchor(anchor);
    ensureAnimation();
    return true;
  }
  function aimAtScene() {
    cameraTarget.copy(player.position);
    cameraTarget.y = 0.3;
    composeCamera(1, 23.5);
  }
  /** Factors multiply the user's zoom; angle deltas use degrees. Invalid values leave the camera unchanged. */
  function adjustCamera({ zoomFactor = 1, yawDelta = 0, pitchDelta = 0 } = {}) {
    if (
      disposed ||
      contextLost ||
      !Number.isFinite(zoomFactor) ||
      zoomFactor <= 0 ||
      !Number.isFinite(yawDelta) ||
      !Number.isFinite(pitchDelta)
    )
      return false;
    manualCamera = true;
    userZoom = THREE.MathUtils.clamp(userZoom * zoomFactor, 0.6, 1.8);
    cameraYaw = (((cameraYaw + yawDelta) % 360) + 360) % 360;
    cameraPitch = THREE.MathUtils.clamp(cameraPitch + pitchDelta, 25, 70);
    cameraFrom.copy(camera.position);
    targetFrom.copy(target);
    zoomFrom = camera.zoom;
    startTime = null;
    if (activeAnchor) aimAtAnchor(activeAnchor);
    else aimAtScene();
    ensureAnimation();
    return true;
  }
  function resetCamera() {
    if (disposed || contextLost) return false;
    return adjustCamera({
      zoomFactor: 1 / userZoom,
      yawDelta: 35 - cameraYaw,
      pitchDelta: 43 - cameraPitch,
    });
  }

  // Moving actors and carried props are resolved as bodies, never baked into the room geometry.
  for (const object of [
    player,
    curator,
    moro,
    trolley,
    boat,
    damagedBoat,
    ledger,
    blurredLedger,
    batteryProp,
    floorShadows,
    beacon,
    staticRoot,
    water,
  ])
    object.userData.collision = 'none';
  let obstacles = collectStaticColliders(scene);
  let towingMoro = false,
    playerBlockedFor = 0;
  function bodyFor(object) {
    return {
      id: object === player ? 'player' : object === curator ? 'yunseo' : 'moro',
      x: object.position.x,
      z: object.position.z,
      radius:
        object === player ? 0.38 : object === curator ? 0.4 : moroUsesTrolley() ? 0.65 : 0.46,
    };
  }
  function activeBodies() {
    return [
      bodyFor(player),
      ...actors
        .filter((actor) => actor.object.visible && actor.initialized)
        .map((actor) => bodyFor(actor.object)),
    ];
  }
  function canWalk(x, z, body = bodyFor(player), occupants = []) {
    return canOccupy(body, x, z, obstacles, occupants);
  }
  function clearPlacement(object, point, roomId, occupants = activeBodies()) {
    const body = bodyFor(object);
    const clear = (x, z) => roomAt(x, z) === roomId && canWalk(x, z, body, occupants);
    if (clear(point.x, point.z)) return point.clone();
    for (let radius = 0.35; radius <= 5; radius += 0.35)
      for (let index = 0; index < 24; index++) {
        const angle = (index * Math.PI) / 12;
        const x = point.x + Math.cos(angle) * radius,
          z = point.z + Math.sin(angle) * radius;
        if (clear(x, z)) return new THREE.Vector3(x, point.y, z);
      }
    throw new Error(
      `No clear ${body.id} placement in room ${roomId}; move overlapping furniture.`
    );
  }
  function controlsBlocked() {
    return Boolean(
      document.activeElement?.closest(
        'input,textarea,select,button,summary,[contenteditable="true"]'
      ) || document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]')
    );
  }
  function canMove() {
    return (
      current.mode === 'map' &&
      current.interactive &&
      ['exploring', 'travelling', 'input'].includes(current.phase) &&
      !activeAnchor
    );
  }
  function nearbyHotspot() {
    if (!current.interactive) return null;
    let nearest = null,
      distance = 2;
    for (const hotspot of current.hotspots) {
      const actor = actors.find((item) => item.id === hotspot.anchor);
      if (actor && !canInspectActor(actor)) continue;
      const point = anchorShape(hotspot.anchor)?.point;
      if (!point) continue;
      const gap = Math.hypot(player.position.x - point.x, player.position.z - point.z);
      if (gap < distance) {
        distance = gap;
        nearest = hotspot;
      }
    }
    return nearest;
  }
  function navigationBody() {
    const body = bodyFor(player);
    // A towed trolley cuts inside turns; route the carrier with room for the wider load.
    return towingMoro ? { ...body, radius: 0.9 } : body;
  }
  function findPath(from, x, z, body = navigationBody(), occupants = []) {
    const clear = (x, z) => canWalk(x, z, body, occupants);
    if (!clear(x, z)) return null;
    const step = 0.5,
      size = 101,
      origin = -25;
    // A reachable continuous point can round into furniture; choose a visible, walkable grid corner.
    const gridPoint = (x, z) => {
      const gx = (x - origin) / step,
        gz = (z - origin) / step,
        candidates = [];
      for (const ix of new Set([Math.floor(gx), Math.ceil(gx)]))
        for (const iz of new Set([Math.floor(gz), Math.ceil(gz)])) {
          if (ix < 0 || iz < 0 || ix >= size || iz >= size) continue;
          const px = origin + ix * step,
            pz = origin + iz * step;
          let segmentClear = true;
          for (let i = 0; i <= 10; i++)
            if (!clear(x + ((px - x) * i) / 10, z + ((pz - z) * i) / 10)) {
              segmentClear = false;
              break;
            }
          if (segmentClear) candidates.push([ix, iz, Math.hypot(px - x, pz - z)]);
        }
      candidates.sort((a, b) => a[2] - b[2]);
      return candidates[0] ?? null;
    };
    const startPoint = gridPoint(from.x, from.z),
      endPoint = gridPoint(x, z);
    if (!startPoint || !endPoint) return null;
    const [startX, startZ] = startPoint,
      [endX, endZ] = endPoint;
    const start = startZ * size + startX,
      goal = endZ * size + endX;
    const previous = new Int32Array(size * size);
    previous.fill(-1);
    previous[start] = start;
    const clearance = new Map();
    const edgeClear = (gx, gz, nx, nz) => {
      const key =
        Math.min(gz * size + gx, nz * size + nx) * size * size +
        Math.max(gz * size + gx, nz * size + nx);
      if (clearance.has(key)) return clearance.get(key);
      for (let i = 1; i <= 5; i++)
        if (
          !clear(
            origin + (gx + ((nx - gx) * i) / 5) * step,
            origin + (gz + ((nz - gz) * i) / 5) * step
          )
        ) {
          clearance.set(key, false);
          return false;
        }
      clearance.set(key, true);
      return true;
    };
    const queue = [start];
    let head = 0;
    while (head < queue.length && previous[goal] === -1) {
      const index = queue[head++],
        gx = index % size,
        gz = Math.floor(index / size);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = gx + dx,
          nz = gz + dz,
          next = nz * size + nx;
        if (
          nx < 0 ||
          nz < 0 ||
          nx >= size ||
          nz >= size ||
          previous[next] !== -1 ||
          !edgeClear(gx, gz, nx, nz)
        )
          continue;
        previous[next] = index;
        queue.push(next);
      }
    }
    if (previous[goal] === -1) return null;
    const points = [[x, z]];
    let index = goal;
    while (index !== start) {
      points.push([origin + (index % size) * step, origin + Math.floor(index / size) * step]);
      index = previous[index];
    }
    points.push([origin + startX * step, origin + startZ * step]);
    return points.reverse();
  }
  function routeTo(x, z) {
    let path = findPath(player.position, x, z);
    if (!path && towingMoro) {
      // A floor tap can fit the carrier but leave no room for its load near a wall.
      for (const radius of [0.25, 0.5, 0.75, 1]) {
        for (let index = 0; index < 16 && !path; index++) {
          const angle = (index * Math.PI) / 8;
          path = findPath(
            player.position,
            x + Math.cos(angle) * radius,
            z + Math.sin(angle) * radius
          );
        }
        if (path) break;
      }
    }
    if (!path) return false;
    walkPath = path;
    playerBlockedFor = 0;
    return true;
  }
  function actorMeetingPoint(actor, roomId) {
    const room = ROOMS.find((item) => item.id === roomId);
    return clearPlacement(
      actor.object,
      new THREE.Vector3(
        room.x + (actor.id === 'yunseo' ? -2 : 0.75),
        0,
        room.z + (actor.id === 'yunseo' ? 1 : 1.2)
      ),
      roomId
    );
  }
  function canInspectActor(actor) {
    return (
      actor.object.visible &&
      roomAt(player.position.x, player.position.z) === current.currentRoomId &&
      roomAt(actor.object.position.x, actor.object.position.z) === current.currentRoomId &&
      Math.hypot(
        player.position.x - actor.object.position.x,
        player.position.z - actor.object.position.z
      ) < 1.98
    );
  }
  function actorApproachPoint(actor) {
    if (
      actor.path.length === 0 &&
      roomAt(actor.object.position.x, actor.object.position.z) === current.currentRoomId
    )
      return actor.object.position.clone();
    return actorMeetingPoint(actor, current.currentRoomId);
  }
  function moroUsesTrolley() {
    return current.flags.moro === 'asleep' || current.flags.method === 'carry';
  }
  function stageActor(actor, room, needed, reset) {
    if (reset) {
      actor.initialized = false;
      actor.destination = null;
      actor.path = [];
      actor.moving = false;
      actor.object.visible = false;
    }
    if (!needed) {
      actor.object.visible = false;
      actor.path = [];
      return;
    }
    const { x, z } = actorMeetingPoint(actor, room.id);
    actor.object.visible = true;
    actor.waitForPlayer = current.travel?.companion === actor.id;
    const destination = `${room.id}:${x}:${z}`;
    if (!actor.initialized || current.mode !== 'map') {
      actor.object.position.set(x, actor.id === 'moro' && moroUsesTrolley() ? 0.22 : 0.05, z);
      actor.initialized = true;
      actor.destination = destination;
      actor.path = [];
      if (
        actor.id === 'moro' &&
        current.storyVersion === 'museum-map-4' &&
        current.sceneId === 'S01'
      ) {
        actor.object.position.copy(
          clearPlacement(
            actor.object,
            new THREE.Vector3(room.x + 0.75, 0.05, room.z + 4.4),
            room.id
          )
        );
        actor.path = findPath(actor.object.position, x, z, bodyFor(actor.object)) ?? [];
      }
      return;
    }
    if (
      !canWalk(
        actor.object.position.x,
        actor.object.position.z,
        bodyFor(actor.object),
        activeBodies()
      )
    ) {
      const roomId = roomAt(actor.object.position.x, actor.object.position.z) ?? room.id;
      actor.object.position.copy(clearPlacement(actor.object, actor.object.position, roomId));
    }
    if (actor.id === 'moro' && moroUsesTrolley()) {
      actor.destination = destination;
      actor.path = [];
      return;
    }
    if (actor.destination === destination) return;
    actor.blockedFor = 0;
    actor.destination = destination;
    actor.path = findPath(actor.object.position, x, z, bodyFor(actor.object)) ?? [];
  }
  function advanceActors(delta) {
    for (const actor of actors) {
      actor.moving = false;
      if (actor.id === 'moro' && moroUsesTrolley()) {
        actor.path = [];
        continue;
      }
      const last = actor.path.at(-1),
        position = actor.object.position;
      if (!actor.object.visible || !last) continue;
      const conversationTarget = current.hotspots.find(
        (hotspot) => hotspot.id === (pendingInspect ?? current.activeHotspot)
      );
      if (
        current.phase !== 'travelling' &&
        conversationTarget?.anchor === actor.id &&
        canInspectActor(actor)
      ) {
        actor.object.rotation.y = Math.atan2(
          player.position.x - position.x,
          player.position.z - position.z
        );
        continue;
      }
      const ahead =
        Math.hypot(position.x - last[0], position.z - last[1]) <
        Math.hypot(player.position.x - last[0], player.position.z - last[1]);
      if (actor.waitForPlayer && ahead && position.distanceTo(player.position) > 5.5) continue;
      let remaining = (actor.waitForPlayer ? 3.2 : 3.8) * delta;
      while (remaining > 0 && actor.path.length) {
        const next = actor.path[0],
          dx = next[0] - position.x,
          dz = next[1] - position.z,
          distance = Math.hypot(dx, dz);
        if (distance < 0.04) {
          actor.path.shift();
          continue;
        }
        const step = Math.min(remaining, distance, 0.06);
        const result = moveBody(
          bodyFor(actor.object),
          (dx / distance) * step,
          (dz / distance) * step,
          obstacles,
          activeBodies()
        );
        const moved = Math.hypot(result.x - position.x, result.z - position.z);
        position.x = result.x;
        position.z = result.z;
        if (result.blocked) {
          actor.blockedFor = (actor.blockedFor ?? 0) + delta;
          if (actor.blockedFor >= 0.35) {
            actor.blockedFor = 0;
            const roomId = roomAt(last[0], last[1]);
            const goal = clearPlacement(
              actor.object,
              new THREE.Vector3(last[0], 0, last[1]),
              roomId
            );
            actor.path =
              findPath(position, goal.x, goal.z, bodyFor(actor.object), activeBodies()) ??
              actor.path;
          }
          actor.moving = moved > 0.001;
          break;
        }
        actor.blockedFor = 0;
        actor.object.rotation.y = Math.atan2(dx, dz);
        actor.moving = true;
        remaining -= step;
      }
    }
  }
  function syncMoroTransport() {
    const onTrolley = moroUsesTrolley();
    const attached = moro.visible && onTrolley && Boolean(current.travel);
    if (attached && !towingMoro) {
      const body = bodyFor(moro),
        occupants = activeBodies();
      // Attach only at a clear nearby position; the trolley then follows continuously, not by teleporting.
      const candidates = [];
      const destination = ROOMS.find((room) => room.id === current.travel.toRoomId);
      const heading = Math.atan2(
        destination.x - player.position.x,
        destination.z - player.position.z
      );
      for (const distance of [1.12])
        for (let i = 0; i < 24; i++) {
          const angle = heading + Math.PI + (i * Math.PI) / 12;
          const x = player.position.x + Math.sin(angle) * distance,
            z = player.position.z + Math.cos(angle) * distance;
          if (
            roomAt(x, z) === roomAt(player.position.x, player.position.z) &&
            canWalk(x, z, body, occupants)
          )
            candidates.push({ x, z });
        }
      if (candidates.length) moro.position.set(candidates[0].x, 0.22, candidates[0].z);
    }
    towingMoro =
      attached &&
      Math.hypot(player.position.x - moro.position.x, player.position.z - moro.position.z) <=
        1.14;
    moro.position.y = onTrolley ? 0.22 : 0.05;
    trolley.position.copy(moro.position);
    trolley.position.y = 0.08;
    trolley.rotation.y = moro.rotation.y;
  }
  function movePlayer(dx, dz) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.06));
    let blocked = false;
    for (let index = 0; index < steps; index++) {
      const occupants = activeBodies();
      const next = moveBody(bodyFor(player), dx / steps, dz / steps, obstacles, occupants);
      if (towingMoro) {
        const gapX = next.x - moro.position.x,
          gapZ = next.z - moro.position.z;
        const gap = Math.hypot(gapX, gapZ),
          pull = Math.max(0, gap - 1.12);
        const trailer = moveBody(
          bodyFor(moro),
          gap ? (gapX / gap) * pull : 0,
          gap ? (gapZ / gap) * pull : 0,
          obstacles,
          occupants.map((body) =>
            body.id === 'player' ? { ...body, x: next.x, z: next.z } : body
          )
        );
        if (Math.hypot(next.x - trailer.x, next.z - trailer.z) > 1.14) {
          blocked = true;
          break;
        }
        if (pull > 0) moro.rotation.y = Math.atan2(gapX, gapZ);
        moro.position.x = trailer.x;
        moro.position.z = trailer.z;
      }
      player.position.x = next.x;
      player.position.z = next.z;
      blocked ||= next.blocked;
    }
    return blocked;
  }
  function objectivePosition() {
    const objective =
      current.objectiveTarget ?? (current.travel ? { roomId: current.travel.toRoomId } : null);
    if (!objective) return null;
    if (objective.hotspotId) {
      const hotspot = current.hotspots.find((item) => item.id === objective.hotspotId);
      const actor = actors.find((item) => item.id === hotspot?.anchor);
      if (actor) return actorApproachPoint(actor);
      const point = hotspot && anchorShape(hotspot.anchor)?.point;
      return point ? new THREE.Vector3(point.x, 0.04, point.z) : null;
    }
    const destination = ROOMS.find((room) => room.id === objective.roomId);
    if (!destination) return null;
    let currentRoom = roomAt(player.position.x, player.position.z);
    if (!currentRoom) {
      const corridor = CORRIDORS.find(
        (area) =>
          Math.abs(player.position.x - area.x) <= area.width / 2 &&
          Math.abs(player.position.z - area.z) <= area.depth / 2
      );
      if (corridor)
        currentRoom = [corridor.from, corridor.to]
          .map((id) => ROOMS.find((room) => room.id === id))
          .sort(
            (a, b) =>
              Math.abs(a.x - destination.x) +
              Math.abs(a.z - destination.z) -
              Math.abs(b.x - destination.x) -
              Math.abs(b.z - destination.z)
          )[0].id;
    }
    const room = ROOMS.find((item) => item.id === (currentRoom ?? current.currentRoomId));
    if (room.id === destination.id)
      return new THREE.Vector3(destination.x, 0.04, destination.z + 3);
    const queue = [[room.id]],
      visited = new Set([room.id]);
    let nextRoom = null;
    while (queue.length) {
      const path = queue.shift();
      if (path.at(-1) === destination.id) {
        nextRoom = ROOMS.find((item) => item.id === path[1]);
        break;
      }
      for (const pair of CONNECTIONS) {
        const next =
          pair[0] === path.at(-1) ? pair[1] : pair[1] === path.at(-1) ? pair[0] : null;
        if (next && !visited.has(next)) {
          visited.add(next);
          queue.push([...path, next]);
        }
      }
    }
    if (!nextRoom) return null;
    return new THREE.Vector3(
      room.x + Math.sign(nextRoom.x - room.x) * (room.width / 2 - 0.5),
      0.04,
      room.z + Math.sign(nextRoom.z - room.z) * (room.depth / 2 - 0.5)
    );
  }
  function approach(hotspotId) {
    const hotspot = current.hotspots.find((item) => item.id === hotspotId);
    if (!hotspot || !current.interactive || disposed) return false;
    if (contextLost || current.mode !== 'map') {
      onInspect(hotspotId);
      return true;
    }
    const actor = actors.find((item) => item.id === hotspot.anchor);
    // A travelling speaker meets the player in this scene, never back in the previous room.
    const point = actor ? actorApproachPoint(actor) : anchorShape(hotspot.anchor)?.point;
    if (!point) return false;
    if (
      actor
        ? canInspectActor(actor)
        : Math.hypot(player.position.x - point.x, player.position.z - point.z) < 2
    ) {
      onInspect(hotspotId);
      return true;
    }
    const candidates = [];
    for (const radius of [1.3, 1.65, 1.9])
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6;
        const x = point.x + Math.cos(angle) * radius,
          z = point.z + Math.sin(angle) * radius;
        if (canWalk(x, z) && (!actor || roomAt(x, z) === current.currentRoomId))
          candidates.push([x, z]);
      }
    candidates.sort(
      (a, b) =>
        Math.hypot(a[0] - player.position.x, a[1] - player.position.z) -
        Math.hypot(b[0] - player.position.x, b[1] - player.position.z)
    );
    for (const candidate of candidates)
      if (routeTo(...candidate)) {
        pendingInspect = hotspotId;
        renderer.domElement.focus({ preventScroll: true });
        ensureAnimation();
        return true;
      }
    return false;
  }
  function ensureAnimation() {
    if (frame === null && !disposed && !contextLost && !document.hidden)
      frame = requestAnimationFrame(animate);
  }
  function keydown(event) {
    if (controlsBlocked() || !canMove() || event.altKey || event.metaKey || event.ctrlKey)
      return;
    const key = event.key.toLowerCase();
    if (key === 'e') {
      const hotspot = nearbyHotspot();
      if (hotspot) {
        event.preventDefault();
        approach(hotspot.id);
      }
      return;
    }
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key))
      return;
    event.preventDefault();
    pressed.add(key);
    walkPath = [];
    pendingInspect = null;
    ensureAnimation();
  }
  function keyup(event) {
    pressed.delete(event.key.toLowerCase());
  }
  function clearKeys() {
    pressed.clear();
  }
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2(),
    floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    floorPoint = new THREE.Vector3();
  function floorClick(event) {
    if (!canMove() || cameraInputBlocked()) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(floorPlane, floorPoint)) return;
    renderer.domElement.focus({ preventScroll: true });
    pendingInspect = null;
    if (routeTo(floorPoint.x, floorPoint.z)) ensureAnimation();
  }
  function cameraInputBlocked() {
    return Boolean(
      document.activeElement?.closest('input,textarea,select,[contenteditable="true"]') ||
        document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]')
    );
  }
  const activePointers = new Map();
  let pinch = null;
  function touchPair() {
    const touches = [...activePointers.values()].filter((point) => point.touch);
    if (touches.length < 2) return null;
    return {
      distance: Math.hypot(touches[1].x - touches[0].x, touches[1].y - touches[0].y),
      x: (touches[0].x + touches[1].x) / 2,
    };
  }
  function pointerDown(event) {
    if (disposed || contextLost || cameraInputBlocked() || ![0, 2].includes(event.button))
      return;
    const touch = event.pointerType === 'touch';
    const orbit = !touch && (event.button === 2 || event.shiftKey);
    activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      touch,
      orbit,
      moved: false,
      multi: false,
    });
    renderer.domElement.setPointerCapture(event.pointerId);
    renderer.domElement.focus({ preventScroll: true });
    pinch = touchPair();
    if (pinch) {
      for (const point of activePointers.values()) point.multi = true;
      walkPath = [];
      pendingInspect = null;
      pressed.clear();
    }
    if (orbit) {
      walkPath = [];
      pendingInspect = null;
      pressed.clear();
      event.preventDefault();
    }
  }
  function pointerMove(event) {
    const point = activePointers.get(event.pointerId);
    if (!point) return;
    const dx = event.clientX - point.x,
      dy = event.clientY - point.y;
    point.x = event.clientX;
    point.y = event.clientY;
    point.moved ||= Math.hypot(point.x - point.startX, point.y - point.startY) > 8;
    if (cameraInputBlocked()) {
      point.multi = true;
      return;
    }
    const nextPinch = touchPair();
    if (nextPinch && pinch) {
      event.preventDefault();
      adjustCamera({
        zoomFactor: pinch.distance > 0 ? nextPinch.distance / pinch.distance : 1,
        yawDelta: -(nextPinch.x - pinch.x) * 0.3,
      });
      pinch = nextPinch;
      return;
    }
    if (point.orbit) {
      event.preventDefault();
      adjustCamera({ yawDelta: -dx * 0.3, pitchDelta: dy * 0.25 });
    }
  }
  function pointerUp(event) {
    const point = activePointers.get(event.pointerId);
    if (!point) return;
    activePointers.delete(event.pointerId);
    pinch = touchPair();
    if (renderer.domElement.hasPointerCapture(event.pointerId))
      renderer.domElement.releasePointerCapture(event.pointerId);
    if (
      event.type === 'pointerup' &&
      !point.orbit &&
      !point.multi &&
      !point.moved &&
      Math.hypot(event.clientX - point.startX, event.clientY - point.startY) <= 8
    )
      floorClick(event);
  }
  function cancelPointerGestures() {
    for (const id of activePointers.keys())
      if (renderer.domElement.hasPointerCapture(id))
        renderer.domElement.releasePointerCapture(id);
    activePointers.clear();
    pinch = null;
  }
  function wheel(event) {
    if (disposed || contextLost || cameraInputBlocked()) return;
    event.preventDefault();
    const delta =
      event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    adjustCamera({ zoomFactor: Math.exp(-THREE.MathUtils.clamp(delta, -200, 200) * 0.002) });
  }
  function contextMenu(event) {
    if (!cameraInputBlocked()) event.preventDefault();
  }
  renderer.domElement.tabIndex = 0;
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.addEventListener('pointerdown', pointerDown);
  renderer.domElement.addEventListener('pointermove', pointerMove);
  renderer.domElement.addEventListener('pointerup', pointerUp);
  renderer.domElement.addEventListener('pointercancel', pointerUp);
  renderer.domElement.addEventListener('lostpointercapture', pointerUp);
  renderer.domElement.addEventListener('wheel', wheel, { passive: false });
  renderer.domElement.addEventListener('contextmenu', contextMenu);
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', clearKeys);
  window.addEventListener('blur', cancelPointerGestures);
  function advancePlayer(now) {
    const delta = lastStepAt === null ? 0 : Math.min(0.1, (now - lastStepAt) / 1000);
    lastStepAt = now;
    avatarMoving = false;
    advanceActors(delta);
    if (canMove() && !controlsBlocked()) {
      let dx =
        Number(pressed.has('d') || pressed.has('arrowright')) -
        Number(pressed.has('a') || pressed.has('arrowleft'));
      let dz =
        Number(pressed.has('s') || pressed.has('arrowdown')) -
        Number(pressed.has('w') || pressed.has('arrowup'));
      // Follow the camera's actual orientation, including an orbit still settling onscreen.
      const screenX = dx,
        screenZ = dz;
      const effectiveYaw = Math.atan2(
        camera.position.x - target.x,
        camera.position.z - target.z
      );
      dx = screenX * Math.cos(effectiveYaw) + screenZ * Math.sin(effectiveYaw);
      dz = -screenX * Math.sin(effectiveYaw) + screenZ * Math.cos(effectiveYaw);
      const destination = walkPath[0];
      if (dx === 0 && dz === 0 && destination) {
        dx = destination[0] - player.position.x;
        dz = destination[1] - player.position.z;
        // Waypoint slack can leave the final approach point outside interaction range.
        if (Math.hypot(dx, dz) < 0.12 && (!pendingInspect || walkPath.length > 1)) {
          walkPath.shift();
          dx = 0;
          dz = 0;
        }
      }
      const length = Math.hypot(dx, dz);
      if (length > 0) {
        const distance = Math.min(
          3.6 * delta,
          destination && pressed.size === 0 ? length : Infinity
        );
        const beforeX = player.position.x,
          beforeZ = player.position.z;
        const blocked = movePlayer((dx / length) * distance, (dz / length) * distance);
        avatarMoving =
          Math.hypot(player.position.x - beforeX, player.position.z - beforeZ) > 0.001;
        if (blocked && destination) {
          playerBlockedFor += delta;
          if (playerBlockedFor >= 0.35) {
            playerBlockedFor = 0;
            const goal = walkPath.at(-1);
            walkPath =
              findPath(
                player.position,
                goal[0],
                goal[1],
                navigationBody(),
                activeBodies().filter((body) => !towingMoro || body.id !== 'moro')
              ) ?? walkPath;
          }
        } else playerBlockedFor = 0;
        player.rotation.y = Math.atan2(dx, dz);
      }
      if (pendingInspect) {
        const hotspot = current.hotspots.find((item) => item.id === pendingInspect);
        const actor = actors.find((item) => item.id === hotspot?.anchor);
        const point = anchorShape(hotspot?.anchor)?.point;
        if (
          actor
            ? canInspectActor(actor)
            : point &&
              Math.hypot(player.position.x - point.x, player.position.z - point.z) < 1.98
        ) {
          const id = pendingInspect;
          pendingInspect = null;
          walkPath = [];
          onInspect(id);
        } else if (!hotspot || (!actor && walkPath.length === 0)) pendingInspect = null;
      }
    }
    syncMoroTransport();
    playerLegs.forEach(
      (leg, i) =>
        (leg.rotation.x =
          avatarMoving && !motionPreference.matches
            ? Math.sin(now * 0.014 + i * Math.PI) * 0.5
            : 0)
    );
    const destination = current.travel?.toRoomId;
    const objective = objectivePosition();
    beacon.visible = Boolean(objective) && !activeAnchor;
    if (objective) {
      beacon.position.copy(objective);
      beaconArrow.position.y =
        0.9 + (motionPreference.matches ? 0 : Math.sin(now * 0.004) * 0.12);
      beaconRing.rotation.z = motionPreference.matches ? 0 : now * 0.0003;
    }
    if (destination) {
      if (roomAt(player.position.x, player.position.z) !== destination) lastArrival = null;
      if (
        roomAt(player.position.x, player.position.z) === destination &&
        (!towingMoro || roomAt(moro.position.x, moro.position.z) === destination) &&
        lastArrival !== destination
      ) {
        lastArrival = destination;
        walkPath = [];
        pendingInspect = null;
        onArrive(destination);
      }
    }
    if (now - lastNavigationAt >= 100) {
      lastNavigationAt = now;
      const value = {
        x: Math.round(player.position.x * 100) / 100,
        z: Math.round(player.position.z * 100) / 100,
        roomId: roomAt(player.position.x, player.position.z),
        targetRoomId: destination ?? null,
        moving: avatarMoving,
        nearbyLabel: nearbyHotspot()?.label ?? null,
      };
      const signature = JSON.stringify(value);
      if (signature !== lastNavigation) {
        lastNavigation = signature;
        onNavigation(value);
      }
    }
  }

  function placeSpeakerMarker() {
    const actor =
      speaking === '윤서' && curator.visible
        ? curatorHead
        : speaking === '모로' && moro.visible && current.flags.moro !== 'asleep'
        ? moro
        : speaking === '나래' && roomRemoteDisplays[current.currentRoomId]?.portrait.visible
        ? roomRemoteDisplays[current.currentRoomId].screen
        : null;
    if (!actor) {
      speakerMarker.style.display = 'none';
      return;
    }
    actor.getWorldPosition(projectedSpeaker);
    projectedSpeaker.y += speaking === '윤서' ? 0.42 : speaking === '모로' ? 1.22 : 0.78;
    projectedSpeaker.project(camera);
    if (Math.abs(projectedSpeaker.x) > 0.96 || Math.abs(projectedSpeaker.y) > 0.96) {
      speakerMarker.style.display = 'none';
      return;
    }
    if (speakerMarker.textContent !== `${speaking} ···`)
      speakerMarker.textContent = `${speaking} ···`;
    speakerMarker.style.display = 'block';
    speakerMarker.style.transform = `translate3d(${((projectedSpeaker.x + 1) * width) / 2}px,${
      ((1 - projectedSpeaker.y) * height) / 2
    }px,0) translate(-50%,-100%)`;
  }

  function render() {
    if (disposed || contextLost || document.hidden || width < 2 || height < 2) return;
    showSelection();
    renderer.render(scene, camera);
    placeSpeakerMarker();
    placeHotspots();
    renderedFrames++;
  }
  function animate(now) {
    frame = null;
    if (disposed || document.hidden || contextLost) return;
    if (now - lastRenderedAt < 1000 / 30) {
      frame = requestAnimationFrame(animate);
      return;
    }
    lastRenderedAt = now;
    advancePlayer(now);
    if (!activeAnchor) aimAtScene();
    else aimAtAnchor(activeAnchor);
    if (startTime === null) startTime = now;
    const elapsed = motionPreference.matches ? 1 : Math.min(1, (now - startTime) / 450);
    const cameraEase = motionPreference.matches ? 1 : 1 - Math.pow(1 - elapsed, 3);
    if (activeAnchor && !manualCamera) {
      camera.position.lerpVectors(cameraFrom, cameraTo, cameraEase);
      target.lerpVectors(targetFrom, cameraTarget, cameraEase);
    } else {
      const response = motionPreference.matches ? 1 : manualCamera ? 0.35 : 0.2;
      camera.position.lerp(cameraTo, response);
      target.lerp(cameraTarget, response);
    }
    camera.lookAt(target);
    const eased = 1 - Math.pow(1 - elapsed, 3);
    const nextZoom = manualCamera
      ? camera.zoom + (zoomTo - camera.zoom) * (motionPreference.matches ? 1 : 0.35)
      : zoomFrom + (zoomTo - zoomFrom) * eased;
    if (camera.zoom !== nextZoom) {
      camera.zoom = nextZoom;
      camera.updateProjectionMatrix();
    }
    const walking = actors[0].moving;
    if (gestureStart === null) gestureStart = now;
    const gestureTime = Math.min(1, (now - gestureStart) / 1200);
    const gesture = Math.sin(Math.PI * gestureTime);
    const seconds = now / 1000;
    const still = motionPreference.matches;
    const flapTarget = current.sceneId === 'I02' && activeAnchor === 'desk' ? 0.8 : 0.07;
    labelFlap.rotation.z += (flapTarget - labelFlap.rotation.z) * 0.24;
    curatorBody.rotation.z = still ? 0 : Math.sin(seconds * 1.1) * 0.008;
    curatorHead.rotation.x =
      !still && speaking === '윤서' ? Math.sin(gestureTime * Math.PI * 3) * gesture * 0.07 : 0;
    curatorHead.rotation.y = !still && speaking === '윤서' ? gesture * 0.12 : 0;
    curatorArms[1].rotation.x = !still && speaking === '윤서' ? -gesture * 0.7 : 0;
    curatorArms[1].rotation.z = 0.13 + (!still && speaking === '윤서' ? -gesture * 0.25 : 0);
    curatorLegs.forEach((leg, index) => {
      leg.rotation.x = walking && !still ? Math.sin(seconds * 8 + index * Math.PI) * 0.19 : 0;
    });
    const moroAwake = current.flags.moro !== 'asleep';
    moro.rotation.x =
      !still && moroAwake
        ? Math.sin(seconds * 1.4) * 0.012 + (speaking === '모로' ? gesture * 0.055 : 0)
        : 0;
    antenna.rotation.z =
      !still && moroAwake
        ? Math.sin(seconds * 2) * 0.04 +
          (speaking === '모로' ? Math.sin(gestureTime * Math.PI * 4) * gesture * 0.12 : 0)
        : 0;
    eyes.scale.y = !still && moroAwake && seconds % 5 < 0.13 ? 0.08 : 1;
    for (const [roomId, display] of Object.entries(roomRemoteDisplays))
      display.dots.scale.setScalar(
        !still && speaking === '나래' && roomId === current.currentRoomId
          ? 1 + gesture * 0.14
          : 1
      );
    screenPaint.emissiveIntensity = speaking === '나래' ? 0.95 : 0.55;
    dust.position.y = still ? 0 : Math.sin(seconds * 0.35) * 0.06;
    render();
    moving = elapsed < 1 || actors.some((actor) => actor.moving) || gestureTime < 1;
    if (!still || current.mode === 'map') frame = requestAnimationFrame(animate);
  }
  function stop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    moving = false;
  }
  function settle() {
    stop();
    lastStepAt = null;
    camera.position.copy(cameraTo);
    target.copy(cameraTarget);
    camera.lookAt(target);
    camera.zoom = zoomTo;
    camera.updateProjectionMatrix();
    cameraFrom.copy(cameraTo);
    targetFrom.copy(cameraTarget);
    zoomFrom = zoomTo;
    curatorBody.rotation.z = 0;
    curatorHead.rotation.set(0, 0, 0);
    curatorArms[1].rotation.set(0, 0, 0.13);
    curatorLegs.forEach((leg) => {
      leg.rotation.x = 0;
    });
    moro.rotation.x = 0;
    antenna.rotation.z = 0;
    eyes.scale.y = 1;
    for (const display of Object.values(roomRemoteDisplays)) display.dots.scale.setScalar(1);
    dust.position.y = 0;
    labelFlap.rotation.z = current.sceneId === 'I02' && activeAnchor === 'desk' ? 0.8 : 0.07;
    render();
  }
  function refreshProjection() {
    if (width < 2 || height < 2) return;
    const aspect = width / height;
    const mapMode = current.mode === 'map';
    const halfHeight = mapMode ? (width < 700 ? 7 : 7.8) : width < 700 ? 4.1 : 3.8;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    // Walking needs equal sightlines toward the north and south exits.
    camera.top = halfHeight * (mapMode ? 1 : 0.7);
    camera.bottom = -halfHeight * (mapMode ? 1 : 1.3);
    camera.updateProjectionMatrix();
  }
  function resize() {
    const bounds = element.getBoundingClientRect();
    width = Math.round(bounds.width);
    height = Math.round(bounds.height);
    if (width < 2 || height < 2) return;
    renderer.setSize(width, height, false);
    refreshProjection();
    aimAtScene(current.sceneId);
    if (activeAnchor) aimAtAnchor(activeAnchor);
    refreshExclusions();
    settle();
    if (
      (!motionPreference.matches || current.mode === 'map') &&
      !document.hidden &&
      !contextLost
    )
      frame = requestAnimationFrame(animate);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(element);
  function visibilityChanged() {
    if (document.hidden) {
      clearKeys();
      cancelPointerGestures();
      stop();
      return;
    }
    settle();
    if ((!motionPreference.matches || current.mode === 'map') && !contextLost)
      frame = requestAnimationFrame(animate);
  }
  function motionChanged() {
    settle();
    if (
      (!motionPreference.matches || current.mode === 'map') &&
      !document.hidden &&
      !contextLost
    )
      frame = requestAnimationFrame(animate);
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  motionPreference.addEventListener('change', motionChanged);
  function lost(event) {
    event.preventDefault();
    contextLost = true;
    stop();
    fallbackCaption = fallbackIllustration(
      root,
      sceneDescription(current.sceneId, current.flags, current)
    );
    syncFallbackControls();
  }
  renderer.domElement.addEventListener('webglcontextlost', lost);

  function update({
    playthroughId = null,
    storyVersion = null,
    sceneId,
    flags = {},
    phase,
    speaker = null,
    messageId = null,
    hotspots = [],
    activeHotspot = null,
    interactive = false,
    mode = 'map',
    currentRoomId = sceneRoomId(sceneId) ?? 'gallery',
    travel = null,
    objectiveTarget = null,
  }) {
    if (disposed) return;
    // The welcome screen has no story location; keep a valid visual spawn until play begins.
    currentRoomId = currentRoomId ?? sceneRoomId(sceneId) ?? current.currentRoomId ?? 'gallery';
    const previous = current;
    const playthroughChanged = previous.playthroughId !== playthroughId;
    const skippedIntroduction =
      mode === 'map' &&
      sceneId === 'S01' &&
      !travel &&
      currentRoomId === 'gallery' &&
      (previous.sceneId === 'O00' || previous.travel?.companion === 'yunseo') &&
      roomAt(player.position.x, player.position.z) !== 'gallery';
    current = {
      playthroughId,
      storyVersion,
      sceneId,
      flags,
      phase,
      speaker,
      messageId,
      hotspots,
      activeHotspot,
      interactive,
      mode,
      currentRoomId,
      travel,
      objectiveTarget,
    };
    if (
      !spawned ||
      playthroughChanged ||
      skippedIntroduction ||
      (mode === 'map' && previous.mode !== 'map') ||
      (mode !== 'map' && previous.currentRoomId !== currentRoomId)
    ) {
      const [x, z] = spawnForRoom(currentRoomId);
      player.position.set(x, 0.03, z);
      spawned = true;
    }
    if (playthroughChanged || previous.sceneId !== sceneId || previous.phase !== phase) {
      walkPath = [];
      pendingInspect = null;
      pressed.clear();
    }
    if (!travel) lastArrival = null;
    if (previous.activeHotspot !== activeHotspot || previous.sceneId !== sceneId)
      manualCamera = false;
    activeAnchor =
      typeof activeHotspot === 'string'
        ? hotspots.find((item) => item.id === activeHotspot)?.anchor ?? null
        : activeHotspot?.anchor ?? null;
    if (!interactive) hoveredAnchor = null;
    refreshProjection();
    renderer.domElement.setAttribute(
      'aria-label',
      `${sceneDescription(sceneId, flags, current)} 방향키 또는 WASD로 이동하고 E로 조사합니다.`
    );
    if (fallbackCaption) {
      fallbackCaption.textContent = sceneDescription(sceneId, flags, current);
      syncFallbackControls();
      return;
    }
    const sceneRoom = ROOMS.find((room) => room.id === currentRoomId);
    const actorRoom = ROOMS.find((room) => room.id === (travel?.toRoomId ?? currentRoomId));
    const lateScene =
      ['S31', 'F31', 'F32', 'F33', 'F34'].includes(sceneId) || sceneId.startsWith('E');
    const hasAnchor = (anchor) => hotspots.some((hotspot) => hotspot.anchor === anchor);
    const resetActors = playthroughChanged || skippedIntroduction || previous.mode !== mode;
    const needsCurator =
      sceneId === 'O00' ||
      hasAnchor('yunseo') ||
      !['I01', 'I02', 'I03', 'P11', 'P12', 'T21'].includes(sceneId);
    // Destination hotspots are withheld while travelling; cast also includes result speakers.
    const needsMoro = moroIsRevealed(current) && sceneId !== 'I04';
    eyes.visible = flags.moro !== 'asleep';
    antennaLight.visible = flags.moro !== 'asleep';
    for (const [roomId, display] of Object.entries(roomRemoteDisplays))
      display.portrait.visible = lateScene && !travel && roomId === currentRoomId;
    invitation.visible = sceneId === 'O00' || travel?.companion === 'yunseo';
    puzzleBoard.visible = true;
    layeredLabel.visible = sceneId === 'I02';
    keyBundle.visible = true;
    valveWheel.rotation.z = flags.maintenance ? Math.PI / 2 : 0;
    batteryProp.visible = Boolean(flags.battery) || flags.boat === 'locked';
    if (flags.battery) {
      player.add(batteryProp);
      batteryProp.position.set(0, 0.76, -0.32);
      batteryProp.scale.setScalar(0.6);
    } else {
      supplies.add(batteryProp);
      batteryProp.position.set(0, 0.98, 0);
      batteryProp.scale.setScalar(1);
    }
    craneIndicator.material =
      flags.crane === 'stable' ? signal : flags.crane === 'stalled' ? paint.rust : paint.brass;
    const recoveredBoat = ['intact', 'damaged'].includes(flags.boat);
    const recoveryRoom = lateScene ? sceneRoom : ROOMS.find((room) => room.id === 'return');
    packingTable.visible = true;
    preservationKit.visible = sceneId === 'D21';
    originalGuard.visible = flags.record === 'locked';
    for (const prop of [boat, damagedBoat, ledger]) {
      scene.attach(prop);
      prop.scale.setScalar(1);
    }
    boat.visible = flags.boat !== 'sealed' && flags.boat !== 'damaged' && sceneId !== 'E1';
    damagedBoat.visible = flags.boat === 'damaged';
    ledger.visible = flags.record !== 'sealed' && flags.record !== 'unreadable';
    blurredLedger.visible = flags.record === 'unreadable';
    sealedBoxes[0].visible = flags.boat === 'sealed';
    sealedBoxes[1].visible = flags.record === 'sealed';
    boat.position.set(
      recoveredBoat ? recoveryRoom.x + 2.1 : 2.53,
      recoveredBoat ? 0.91 : 0.67,
      recoveredBoat ? recoveryRoom.z + 2.65 : -15.25
    );
    damagedBoat.position.copy(boat.position);
    ledger.position.set(
      flags.record === 'intact' ? recoveryRoom.x + 2.95 : 2.53,
      flags.record === 'intact' ? 0.92 : 0.68,
      flags.record === 'intact' ? recoveryRoom.z + 2.65 : -17.02
    );
    if (travel && recoveredBoat) {
      for (const prop of [boat, damagedBoat]) {
        player.add(prop);
        prop.position.set(-0.45, 0.8, 0.1);
        prop.scale.setScalar(0.45);
      }
    }
    if (travel && flags.record === 'intact') {
      player.add(ledger);
      ledger.position.set(0.4, 0.8, 0.1);
      ledger.scale.setScalar(0.5);
    }
    water.position.y = ['S22', 'P21', 'R31', 'R32'].includes(sceneId) ? 0.43 : 0.26;
    obstacles = collectStaticColliders(scene);
    if (resetActors) {
      towingMoro = false;
      for (const actor of actors) {
        actor.object.visible = false;
        actor.initialized = false;
      }
    }
    if (!canWalk(player.position.x, player.position.z))
      player.position.copy(clearPlacement(player, player.position, currentRoomId, []));
    stageActor(actors[0], actorRoom, needsCurator, resetActors);
    stageActor(actors[1], actorRoom, needsMoro, resetActors);
    trolley.visible = moro.visible && moroUsesTrolley();
    syncMoroTransport();
    const token = messageId ?? `${sceneId}:${speaker}`;
    if (token !== lastMessage) {
      lastMessage = token;
      speaking = speaker;
      gestureStart = null;
    }
    syncHotspots();
    cameraFrom.copy(camera.position);
    targetFrom.copy(target);
    zoomFrom = camera.zoom;
    if (activeAnchor) aimAtAnchor(activeAnchor);
    else aimAtScene();
    if (
      playthroughChanged ||
      skippedIntroduction ||
      (previous.sceneId === 'S01' && !lastVisualState)
    ) {
      camera.position.copy(cameraTo);
      target.copy(cameraTarget);
      camera.lookAt(target);
    }
    lastVisualState = sceneId;
    startTime = null;
    render();
    ensureAnimation();
  }
  resize();
  update(current);
  return {
    update,
    focus,
    approach,
    adjustCamera,
    resetCamera,
    diagnostics() {
      return {
        mode: contextLost ? 'illustration' : 'webgl',
        sceneId: current.sceneId,
        phase: current.phase,
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        materials: materials.size,
        dpr: renderer.getPixelRatio(),
        width,
        height,
        shadowLights: 0,
        postPasses: 0,
        moving,
        renderedFrames,
        targetFps: 30,
        speaking,
        messageId: current.messageId,
        curatorVisible: curator.visible,
        collision: {
          staticBoxes: obstacles.length,
          bodies: activeBodies().map((body) => ({
            ...body,
            clear: canWalk(body.x, body.z, body, activeBodies()),
          })),
          towingMoro,
        },
        actors: actors.map((actor) => ({
          id: actor.id,
          x: actor.object.position.x,
          z: actor.object.position.z,
          visible: actor.object.visible,
          moving: actor.moving,
          waypoints: actor.path.length,
          waiting: actor.waitForPlayer && !actor.moving && actor.path.length > 0,
        })),
        objectiveTarget: current.objectiveTarget,
        objectiveMarker: beacon.visible ? beacon.position.toArray() : null,
        remoteNaraVisible: Boolean(
          roomTerminals[current.currentRoomId]?.visible &&
            roomRemoteDisplays[current.currentRoomId]?.portrait.visible
        ),
        worldHotspots: width >= 700 && !contextLost,
        interactive: current.interactive,
        activeAnchor,
        hotspots: hotspotLayout,
        poses: {
          curatorHead: curatorHead.rotation.x,
          curatorArm: curatorArms[1].rotation.x,
          moroTilt: moro.rotation.x,
          antenna: antenna.rotation.z,
        },
        avatar: {
          x: player.position.x,
          z: player.position.z,
          roomId: roomAt(player.position.x, player.position.z),
          moving: avatarMoving,
          waypoints: walkPath.length,
        },
        currentRoomId: current.currentRoomId,
        targetRoomId: current.travel?.toRoomId ?? null,
        nearbyLabel: nearbyHotspot()?.label ?? null,
        roomCount: ROOMS.length,
        cameraZoom: camera.zoom,
        cameraSettings: { zoom: userZoom, pitch: cameraPitch, yaw: cameraYaw },
        cameraPosition: camera.position.toArray(),
        cameraTarget: target.toArray(),
        cameraFrustum: { top: camera.top, bottom: camera.bottom },
        speakerMarker: speakerMarker.style.display !== 'none' ? speaking : null,
        reducedMotion: motionPreference.matches,
        hidden: document.hidden,
        disposed,
        boat: current.flags.boat,
        moro: current.flags.moro,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      observer.disconnect();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clearKeys);
      cancelPointerGestures();
      window.removeEventListener('blur', cancelPointerGestures);
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointercancel', pointerUp);
      renderer.domElement.removeEventListener('lostpointercapture', pointerUp);
      renderer.domElement.removeEventListener('wheel', wheel);
      renderer.domElement.removeEventListener('contextmenu', contextMenu);
      document.removeEventListener('visibilitychange', visibilityChanged);
      motionPreference.removeEventListener('change', motionChanged);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      for (const item of geometries) item.dispose();
      for (const item of materials) item.dispose();
      for (const item of textures) item.dispose();
      scene.traverse((object) => {
        if (object.isInstancedMesh) object.dispose();
      });
      renderer.dispose();
      root.remove();
    },
  };
}
