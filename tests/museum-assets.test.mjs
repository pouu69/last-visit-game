import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAssetCore, MUSEUM_PALETTE, MUSEUM_ASSET_REVISION } from '../public/assets/shared/core.mjs';
import { createMuseumProps } from '../public/assets/episodes/ep-01/props.mjs';
import { createMuseumActors } from '../public/assets/episodes/ep-01/actors.mjs';
import { collectStaticColliders } from '../public/museum-colliders.mjs';
import { canOccupy } from '../public/museum-collision.mjs';

function fixture(t) {
  const geometries = new Set(), materials = new Set();
  const geometry = (value) => (geometries.add(value), value);
  const material = (color, options = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...options });
    materials.add(value);
    return value;
  };
  const paint = Object.fromEntries(Object.entries(MUSEUM_PALETTE).map(([id, color]) => [id, material(color)]));
  const core = createAssetCore(THREE, {
    geometry, material, paint,
    glass: material('#85aaa0', { transparent: true, opacity: 0.12, depthWrite: false }),
    signal: material('#c9dbb0', { emissive: '#9dc177', emissiveIntensity: 0.7 }),
    waterPaint: material('#548a88', { transparent: true, opacity: 0.78 }),
    contact: material('#384b3d', { transparent: true, opacity: 0.17 }),
  });
  t.after(() => { for (const value of geometries) value.dispose(); for (const value of materials) value.dispose(); });
  const props = createMuseumProps(core), actors = createMuseumActors(core);
  return { props, actors, all: [...props.ids.map((id) => props.create(id)), ...actors.ids.map((id) => actors.create(id))] };
}

test('complete catalogue emits finite 3D geometry with usable normals and a common revision', (t) => {
  const { all, props, actors } = fixture(t);
  const ids = [...props.ids, ...actors.ids];
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 36, 'all original object families have runtime builders');
  for (const asset of all) {
    const id = asset.group.userData.assetId;
    assert.equal(asset.group.userData.assetRevision, MUSEUM_ASSET_REVISION, id);
    assert.ok(Array.isArray(asset.group.userData.assetColliders), id);
    const size = new THREE.Box3().setFromObject(asset.group).getSize(new THREE.Vector3());
    assert.ok([size.x, size.y, size.z].every((value) => Number.isFinite(value) && value > 0.001), `${id} has actual thickness`);
    let meshCount = 0;
    asset.group.traverse((object) => {
      assert.ok(!object.isSprite, `${id} must not depend on camera-facing sprites`);
      if (!object.isMesh) return;
      meshCount++;
      const position = object.geometry.getAttribute('position');
      const normal = object.geometry.getAttribute('normal');
      assert.ok(position?.count >= 3 && normal?.count === position.count, `${id}: positions/normals`);
      assert.ok(Array.from(position.array).every(Number.isFinite), `${id}: finite positions`);
      assert.ok(Array.from(normal.array).every(Number.isFinite), `${id}: finite normals`);
      for (let index = 0; index < normal.count; index++) {
        const length = Math.hypot(normal.getX(index), normal.getY(index), normal.getZ(index));
        assert.ok(length > 0.05 && length < 1.01, `${id}: nonzero normalized normal at ${index}`);
      }
    });
    assert.ok(meshCount > 0, id);
    for (const collider of asset.group.userData.assetColliders) {
      assert.ok(Object.values(collider).every(Number.isFinite), `${id}: finite collider`);
      assert.ok(collider.minX < collider.maxX && collider.minY < collider.maxY && collider.minZ < collider.maxZ, `${id}: positive collider volume`);
    }
  }
});

test('state and animation handles survive compaction inside their owning model', (t) => {
  const { props, actors } = fixture(t);
  const checks = [
    [props.create('storage-bays'), ['water']], [props.create('notice-board'), ['face', 'diagram']],
    [props.create('valve'), ['wheel']], [props.create('supplies'), ['battery']],
    [props.create('layered-label'), ['flap']], [props.create('control-panel'), ['indicator']],
    [actors.create('moro'), ['eyes', 'antenna', 'antennaLight']],
    [actors.create('curator'), ['body', 'head', 'arms', 'legs']],
    [actors.create('player'), ['legs']], [actors.create('terminal'), ['screen', 'portrait', 'dots']],
  ];
  for (const [asset, parts] of checks) for (const key of parts) {
    const refs = Array.isArray(asset.parts[key]) ? asset.parts[key] : [asset.parts[key]];
    assert.ok(refs.length > 0, `${key}: at least one part`);
    for (const part of refs) {
      assert.ok(part?.isObject3D, `${asset.group.name}: ${key} exists`);
      assert.equal(asset.group.getObjectById(part.id), part, `${key} remains attached`);
      if (part.isMesh) assert.equal(part.userData.keepMesh, true, `${key}: live mesh must not merge`);
    }
  }
  const terminal = actors.create('terminal').group.clone(true);
  for (const name of ['remote-screen', 'remote-portrait', 'message-dots']) assert.ok(terminal.getObjectByName(name), `${name} survives cloning`);
  const board = props.create('notice-board').group.clone(true);
  for (const name of ['board-face', 'board-diagram']) assert.ok(board.getObjectByName(name), `${name} survives cloning`);
});

test('evidence variants remain separate models with support-compatible dimensions', (t) => {
  const { props } = fixture(t);
  for (const [id, options] of [['paper-boat', { damaged: true }], ['ledger', { blurred: true }]]) {
    const original = props.create(id), variant = props.create(id, options);
    assert.notEqual(original.group, variant.group);
    const a = new THREE.Box3().setFromObject(original.group).getSize(new THREE.Vector3());
    const b = new THREE.Box3().setFromObject(variant.group).getSize(new THREE.Vector3());
    assert.ok(b.x / a.x > 0.65 && b.x / a.x < 1.35, `${id}: state changes preserve placement scale`);
    assert.ok(b.z / a.z > 0.65 && b.z / a.z < 1.35, `${id}: state changes preserve placement depth`);
    original.group.visible = false;
    assert.equal(variant.group.visible, true, `${id}: visibility stays independent`);
  }
});

test('modelled solids have front and back surfaces at four cardinal camera directions', (t) => {
  const { props, actors } = fixture(t);
  const assets = [props.create('ledger'), props.create('battery'), props.create('control-panel'), actors.create('moro'), actors.create('curator'), actors.create('terminal')];
  const ray = new THREE.Raycaster();
  for (const asset of assets) {
    asset.group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(asset.group), center = bounds.getCenter(new THREE.Vector3());
    const radius = bounds.getSize(new THREE.Vector3()).length() + 1;
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const outward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      ray.set(center.clone().addScaledVector(outward, radius), outward.negate());
      assert.ok(ray.intersectObject(asset.group, true).length > 0, `${asset.group.name}: visible surface at yaw ${angle}`);
    }
  }
});

test('door collision proxies leave the opening clear and follow transformed clones', (t) => {
  const { props } = fixture(t);
  const door = props.create('exit-door').group;
  const scene = new THREE.Scene(); scene.add(door);
  const colliders = collectStaticColliders(scene);
  assert.ok(colliders.length >= 2, 'door posts keep physical collision proxies');
  assert.ok(colliders.every((box) => box.maxX < -0.4 || box.minX > 0.4), 'the center passage remains open');
  assert.ok(colliders.some((box) => box.minX < -0.49 && box.maxX > -0.49 && box.maxZ > 0.9), 'the opened solid leaf remains physical beside the passage');
  const clone = door.clone(true); clone.position.set(10, 0, 20); clone.rotation.y = Math.PI / 2; scene.add(clone);
  const all = collectStaticColliders(scene);
  assert.equal(all.length, colliders.length * 2, 'each instance retains its own explicit proxies');
  assert.ok(all.slice(colliders.length).every((box) => box.minX > 9.8 && box.maxX < 11.1 && (box.maxZ < 19.6 || box.minZ > 20.4)));
});

test('exhibit rope remains physical while a nearby inspection position stays reachable', (t) => {
  const { props } = fixture(t);
  const scene = new THREE.Scene();
  scene.add(props.create('exhibit-case').group);
  const colliders = collectStaticColliders(scene), body = { id: 'visitor', radius: 0.38 };
  assert.equal(canOccupy(body, 0, 1.1, colliders), false, 'cannot walk through the rope in front of the case');
  assert.equal(canOccupy(body, 0, 1.7, colliders), true, 'can stand within the two-unit inspection range');
});

test('authored sign textures use the full UV range without clipping at beveled cap coordinates', (t) => {
  const { props } = fixture(t);
  const texture = new THREE.Texture(), faceMaterial = new THREE.MeshStandardMaterial({ map: texture });
  t.after(() => { texture.dispose(); faceMaterial.dispose(); });
  for (const id of ['notice-board', 'map-lectern', 'invitation']) {
    const face = props.create(id, { faceMaterial }).parts.face;
    const uv = face.geometry.getAttribute('uv');
    assert.equal(Math.min(...uv.array), 0, `${id}: full origin`);
    assert.equal(Math.max(...uv.array), 1, `${id}: full extent`);
    assert.ok(Array.from(uv.array).every((value) => value >= 0 && value <= 1), `${id}: no clamped texture area`);
  }
});
