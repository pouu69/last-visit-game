import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAssetCore, MUSEUM_PALETTE } from '../public/assets/shared/core.mjs';
import { createMuseumEnvironment, MUSEUM_ENVIRONMENT_REVISION } from '../public/assets/episodes/ep-01/environment.mjs';
import { createMuseumActors } from '../public/assets/episodes/ep-01/actors.mjs';
import { ROOMS, CONNECTIONS, CORRIDORS, walkableAt } from '../public/museum-map.mjs';
import { canOccupy, moveBody } from '../public/museum-collision.mjs';
import { collectStaticColliders } from '../public/museum-colliders.mjs';

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
  t.after(() => {
    for (const value of geometries) value.dispose();
    for (const value of materials) value.dispose();
  });
  return { ...createMuseumEnvironment(core), core };
}

function doorsFor(room) {
  return CONNECTIONS.filter((pair) => pair.includes(room.id)).map((pair) => {
    const other = ROOMS.find((entry) => entry.id === pair.find((id) => id !== room.id));
    if (other.x !== room.x) return other.x < room.x ? 'west' : 'east';
    return other.z < room.z ? 'north' : 'south';
  });
}

test('environment catalogue contains actual 3D surfaces and finite camera-independent geometry', (t) => {
  const kit = fixture(t);
  assert.equal(kit.revision, MUSEUM_ENVIRONMENT_REVISION);
  assert.equal(new Set(kit.ids).size, kit.ids.length, 'catalogue IDs are unambiguous');
  for (const id of ['room-shell', 'corridor-segment', 'courtyard-path', 'water-channel', 'floor-rug', 'service-strip', 'wheel-trail']) {
    assert.ok(kit.ids.includes(id), `${id} has a reusable environment constructor`);
    const asset = kit.create(id);
    assert.equal(asset.group.userData.assetRevision, MUSEUM_ENVIRONMENT_REVISION, id);
    assert.ok(Array.isArray(asset.group.userData.assetColliders), `${id}: explicit collision contract`);
    const size = new THREE.Box3().setFromObject(asset.group).getSize(new THREE.Vector3());
    assert.ok(size.toArray().every((value) => Number.isFinite(value) && value > 0.001), `${id}: real thickness`);
    let meshes = 0;
    asset.group.traverse((object) => {
      assert.ok(!object.isSprite, `${id}: no camera-facing replacement`);
      if (!object.isMesh) return;
      meshes++;
      const positions = object.geometry.getAttribute('position'), normals = object.geometry.getAttribute('normal');
      assert.ok(positions?.count >= 3 && normals?.count === positions.count, `${id}: complete surfaces`);
      assert.ok(Array.from(positions.array).every(Number.isFinite), `${id}: finite positions`);
      assert.ok(Array.from(normals.array).every(Number.isFinite), `${id}: finite normals`);
      for (let index = 0; index < normals.count; index++) {
        const length = Math.hypot(normals.getX(index), normals.getY(index), normals.getZ(index));
        assert.ok(length > 0.05 && length < 1.01, `${id}: usable normal at ${index}`);
      }
    });
    assert.ok(meshes > 0, `${id}: visible model`);
  }
});

test('room doors keep the full circular clearance while closed walls remain physical', (t) => {
  const kit = fixture(t), scene = new THREE.Scene();
  const room = kit.create('room-shell', { width: 12, depth: 10, roomType: 'gallery', doors: ['north', 'south'] });
  scene.add(room.group);
  const boxes = collectStaticColliders(scene), body = { id: 'visitor', radius: 0.38 };
  for (const z of [-5, 5]) {
    for (const x of [-1.42, 0, 1.42]) {
      assert.equal(canOccupy(body, x, z, boxes), true, `3.6-unit aperture at ${x},${z}`);
    }
  }
  for (const x of [-6, 6]) {
    assert.equal(walkableAt(x, 0, body.radius), true, 'shared map alone permits this corridor boundary');
    assert.equal(canOccupy(body, x, 0, boxes), false, 'the authored closed wall blocks it');
  }
  const east = moveBody({ ...body, x: 0, z: 0 }, 8, 0, boxes);
  const west = moveBody({ ...body, x: 0, z: 0 }, -8, 0, boxes);
  assert.equal(east.blocked, true); assert.ok(east.x < 5.6);
  assert.equal(west.blocked, true); assert.ok(west.x > -5.6);
});

test('wall panels have both exterior and interior faces at every cardinal side', (t) => {
  const room = fixture(t).create('room-shell', { width: 12, depth: 10, doors: ['north', 'south'] }).group;
  room.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (const [target, normal] of [
    [[6, 0.3, 0], [1, 0, 0]], [[-6, 0.3, 0], [-1, 0, 0]],
    [[3, 0.3, -5], [0, 0, -1]], [[3, 0.3, 5], [0, 0, 1]],
  ]) {
    for (const sign of [-1, 1]) {
      const direction = new THREE.Vector3(...normal).multiplyScalar(-sign);
      const origin = new THREE.Vector3(...target).addScaledVector(new THREE.Vector3(...normal), sign * 2);
      ray.set(origin, direction); ray.far = 2.2;
      assert.ok(ray.intersectObject(room, true).length > 0, `wall surface ${target} from ${sign < 0 ? 'inside' : 'outside'}`);
    }
  }
});

test('every doorway header clears the tallest walking actor with floor placement and motion allowance', (t) => {
  const kit = fixture(t), actors = createMuseumActors(kit.core);
  const highestActorTop = Math.max(...['curator', 'player', 'moro'].map((id) => {
    const actor = actors.create(id).group;
    actor.position.y = 0.05;
    return new THREE.Box3().setFromObject(actor).max.y;
  }));
  const motionAllowance = 0.08;
  const room = kit.create('room-shell', {
    width: 12, depth: 10, doors: ['north', 'south', 'west', 'east'],
  }).group;
  room.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  ray.far = 2;
  for (const [x, z] of [[0, -5], [0, 5], [-6, 0], [6, 0]]) {
    ray.set(new THREE.Vector3(x, 1.8, z), new THREE.Vector3(0, 1, 0));
    const hits = ray.intersectObject(room, true);
    assert.ok(hits.length > 0, `header has a solid underside at ${x},${z}`);
    assert.ok(hits[0].point.y > highestActorTop + motionAllowance,
      `header at ${x},${z} (${hits[0].point.y.toFixed(3)}) must clear actor top ${highestActorTop.toFixed(3)} plus motion allowance`);
  }
});

test('all authored room connections remain traversable in both directions after environment compaction', (t) => {
  const kit = fixture(t), scene = new THREE.Scene();
  for (const room of ROOMS) {
    const asset = kit.create('room-shell', { width: room.width, depth: room.depth, roomType: room.id, doors: doorsFor(room) });
    asset.group.position.set(room.x, 0, room.z);
    scene.add(asset.group);
  }
  for (const corridor of CORRIDORS) {
    const asset = kit.create('corridor-segment', { width: corridor.width, depth: corridor.depth });
    asset.group.position.set(corridor.x, 0, corridor.z);
    scene.add(asset.group);
  }
  const boxes = collectStaticColliders(scene);
  for (const [fromId, toId] of CONNECTIONS) {
    const from = ROOMS.find((room) => room.id === fromId), to = ROOMS.find((room) => room.id === toId);
    for (const [start, end] of [[from, to], [to, from]]) {
      const body = { id: 'visitor', x: start.x, z: start.z, radius: 0.38 };
      const moved = moveBody(body, end.x - start.x, end.z - start.z, boxes);
      assert.equal(moved.blocked, false, `${start.id} -> ${end.id}`);
      assert.ok(Math.hypot(moved.x - end.x, moved.z - end.z) < 0.001, 'reaches the connected room center');
    }
  }
});

test('corridor rails stay physical on both orientations without covering the center route', (t) => {
  const kit = fixture(t);
  for (const options of [{ width: 16, depth: 3.6, x: -8, z: 0 }, { width: 3.6, depth: 16, x: 0, z: -8 }]) {
    const corridor = kit.create('corridor-segment', options).group;
    corridor.position.set(options.x, 0, options.z);
    const scene = new THREE.Scene(); scene.add(corridor);
    const boxes = collectStaticColliders(scene), body = { id: 'visitor', radius: 0.38 };
    assert.equal(canOccupy(body, options.x, options.z, boxes), true, 'center route stays open');
    for (const sign of [-1, 1]) {
      const x = options.x + (options.width < options.depth ? sign * 1.8 : 0);
      const z = options.z + (options.width > options.depth ? sign * 1.8 : 0);
      assert.equal(canOccupy({ ...body, radius: 0 }, x, z, boxes), false, 'rail itself is physical');
    }
  }
});

test('floor dressings and clue trails never introduce hidden walking obstacles', (t) => {
  const kit = fixture(t), scene = new THREE.Scene();
  for (const id of ['courtyard-path', 'water-channel', 'floor-rug', 'service-strip', 'wheel-trail']) scene.add(kit.create(id).group);
  assert.deepEqual(collectStaticColliders(scene), [], 'decorative floor geometry remains passable');
  assert.equal(canOccupy({ id: 'visitor', radius: 0.38 }, 0, 0, collectStaticColliders(scene)), true);
});
