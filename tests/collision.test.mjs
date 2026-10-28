import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAssetCore, MUSEUM_PALETTE } from '../public/assets/shared/core.mjs';
import { createMuseumEnvironment } from '../public/assets/episodes/ep-01/environment.mjs';
import { collectStaticColliders } from '../public/museum-colliders.mjs';
import { canOccupy, moveBody } from '../public/museum-collision.mjs';
import { CONNECTIONS, ROOMS, walkableAt } from '../public/museum-map.mjs';

const options = { timeout: 5_000 };

function galleryWalls(t) {
  const geometries = new Set(), materials = new Set();
  const material = (color, options = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, ...options });
    materials.add(value);
    return value;
  };
  const paint = Object.fromEntries(Object.entries(MUSEUM_PALETTE).map(([id, color]) => [id, material(color)]));
  const core = createAssetCore(THREE, {
    geometry: (value) => (geometries.add(value), value), material, paint,
    glass: material('#85aaa0'), signal: material('#c9dbb0'),
    waterPaint: material('#548a88'), contact: material('#384b3d'),
  });
  t.after(() => {
    for (const geometry of geometries) geometry.dispose();
    for (const value of materials) value.dispose();
  });
  const room = ROOMS.find((room) => room.id === 'gallery');
  const asset = createMuseumEnvironment(core).create('room-shell', {
    width: room.width, depth: room.depth, roomType: room.id,
    doors: ['north', 'south', 'east', 'west'],
  });
  asset.group.position.set(room.x, 0, room.z);
  return collectStaticColliders(asset.group);
}

test(
  'fast movement stops at a wall instead of entering the next room through it',
  options,
  (t) => {
    const body = Object.freeze({ id: 'player', x: 0, z: 3, radius: 0.38 });
    // Shared room floors now touch; their rendered wall proxies own interior collision.
    const boxes = galleryWalls(t);
    const wall = boxes.filter((box) => box.minX > body.x && box.minZ < body.z && box.maxZ > body.z)
      .sort((a, b) => a.minX - b.minX)[0];
    assert.ok(wall, 'the actual room model must provide an east wall');
    const result = moveBody(body, 16, 0, boxes);
    assert.equal(result.blocked, true);
    assert.ok(
      result.x <= wall.minX - body.radius && result.x > wall.minX - body.radius - 0.06,
      JSON.stringify(result)
    );
    assert.equal(result.z, 3);
    assert.equal(body.x, 0);
  }
);

test(
  'a circular footprint cannot clip diagonal doorway corners between its cardinal samples',
  options,
  () => {
    const edgeZ = ROOMS.find((room) => room.id === 'gallery').depth / 2;
    for (const signX of [-1, 1]) {
      for (const signZ of [-1, 1]) {
        assert.equal(walkableAt(signX * 1.62, signZ * (edgeZ - 0.18), 0.26), false);
        assert.equal(walkableAt(signX * 1.6, signZ * (edgeZ - 0.2), 0.26), true);
      }
    }
    const body = { id: 'player', x: 1.2, z: edgeZ - 0.6, radius: 0.26 };
    const result = moveBody(body, 0.6, 0.6, []);
    assert.equal(result.blocked, true);
    assert.ok(
      Math.hypot(result.x - 1.8, result.z - edgeZ) >= body.radius - 1e-12,
      JSON.stringify(result)
    );
    assert.ok(canOccupy(body, result.x, result.z, []));
  }
);

test(
  'furniture uses circular corner clearance and blocks fast motion while allowing wall sliding',
  options,
  () => {
    const box = Object.freeze({ id: 'table', minX: -1, maxX: 1, minZ: -2, maxZ: 2 });
    const boxes = Object.freeze([box]);
    const body = Object.freeze({ id: 'player', x: -2, z: 0, radius: 0.3 });
    assert.equal(canOccupy(body, 1.25, 2.25, boxes), true);
    assert.equal(canOccupy(body, 1.2, 2.2, boxes), false);
    assert.equal(canOccupy(body, 1.3, 0, boxes), true);
    const crossing = moveBody(body, 4, 0, boxes);
    assert.equal(crossing.blocked, true);
    assert.ok(crossing.x <= -1.3 && crossing.x > -1.36, JSON.stringify(crossing));
    const sliding = moveBody(body, 4, 2, boxes);
    assert.equal(sliding.blocked, true);
    assert.ok(sliding.x <= -1.3, JSON.stringify(sliding));
    assert.ok(Math.abs(sliding.z - 2) < 1e-9, JSON.stringify(sliding));
    assert.ok(canOccupy(body, sliding.x, sliding.z, boxes));
    const thinBox = [{ minX: -0.05, maxX: 0.05, minZ: -1, maxZ: 1 }];
    assert.ok(moveBody(body, 4, 0, thinBox).x <= -0.35);
  }
);

test(
  'bodies stop before another occupant, ignore their own id, and never push or mutate inputs',
  options,
  () => {
    const body = Object.freeze({ id: 'player', x: 0, z: 0, radius: 0.38 });
    const npc = Object.freeze({ id: 'moro', x: 2, z: 0, radius: 0.46 });
    const occupants = Object.freeze([Object.freeze({ ...body }), npc]);
    assert.equal(canOccupy(body, 0, 0, [], occupants), true);
    assert.equal(canOccupy(body, 2, 0, [], occupants), false);
    const result = moveBody(body, 4, 0, [], occupants);
    assert.equal(result.blocked, true);
    assert.ok(result.x <= npc.x - body.radius - npc.radius + 1e-12, JSON.stringify(result));
    assert.ok(
      Math.hypot(result.x - npc.x, result.z - npc.z) >= body.radius + npc.radius - 1e-12
    );
    assert.deepEqual(npc, { id: 'moro', x: 2, z: 0, radius: 0.46 });
    assert.deepEqual(moveBody(body, 0, 0, [], occupants), { x: 0, z: 0, blocked: false });
  }
);

test(
  'all connected doors remain traversable in both directions with circular clearance',
  options,
  () => {
    for (const [from, to] of CONNECTIONS) {
      const a = ROOMS.find((room) => room.id === from);
      const b = ROOMS.find((room) => room.id === to);
      const radius = 0.46;
      for (const offset of [0, -(1.8 - radius), 1.8 - radius]) {
        for (const [start, end] of [
          [a, b],
          [b, a],
        ]) {
          const body = {
            id: 'moro',
            x: start.x + (a.x === b.x ? offset : 0),
            z: start.z + (a.z === b.z ? offset : 0),
            radius,
          };
          const result = moveBody(body, end.x - start.x, end.z - start.z, []);
          const context = `${start.id} → ${end.id}, offset ${offset}: ${JSON.stringify(
            result
          )}`;
          assert.equal(result.blocked, false, context);
          assert.ok(Math.abs(result.x - body.x - end.x + start.x) < 1e-9, context);
          assert.ok(Math.abs(result.z - body.z - end.z + start.z) < 1e-9, context);
        }
      }
    }
  }
);
