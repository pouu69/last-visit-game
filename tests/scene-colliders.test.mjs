import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { collectStaticColliders } from '../public/museum-colliders.mjs';

const options = { timeout: 5_000 };

test(
  'cloned furniture keeps separate world footprints for each transformed instance',
  options,
  (t) => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    t.after(() => {
      geometry.dispose();
      material.dispose();
    });
    const scene = new THREE.Scene();
    const original = new THREE.Group();
    const instances = new THREE.InstancedMesh(geometry, material, 2);
    instances.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-2, 0.5, 0));
    instances.setMatrixAt(1, new THREE.Matrix4().makeTranslation(2, 0.5, 0));
    original.add(instances);
    const table = new THREE.Mesh(geometry, material);
    table.position.set(0, 0.5, 3);
    table.scale.set(2, 1, 1);
    original.add(table);
    original.position.set(-10, 0, 0);
    scene.add(original);
    const clone = original.clone(true);
    clone.position.set(10, 0, 20);
    clone.rotation.y = Math.PI / 2;
    clone.scale.set(2, 1, 1);
    scene.add(clone);

    const colliders = collectStaticColliders(scene);
    const bounds = colliders.map(({ minX, maxX, minZ, maxZ }) =>
      [minX, maxX, minZ, maxZ].map((value) => Number(value.toFixed(6)))
    );
    assert.deepEqual(bounds, [
      [-12.5, -11.5, -0.5, 0.5],
      [-8.5, -7.5, -0.5, 0.5],
      [-11, -9, 2.5, 3.5],
      [9.5, 10.5, 23, 25],
      [9.5, 10.5, 15, 17],
      [12.5, 13.5, 18, 22],
    ]);
    assert.equal(new Set(colliders.map(({ id }) => id)).size, 6);
    assert.ok(Object.isFrozen(colliders));
    assert.ok(colliders.every(Object.isFrozen));
    assert.equal(geometry.boundingBox.min.x, -0.5);
    assert.equal(geometry.boundingBox.max.x, 0.5);
  }
);

test(
  'door apertures stay clear of floors, overhead beams and excluded subtrees',
  options,
  (t) => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    t.after(() => {
      geometry.dispose();
      material.dispose();
    });
    const scene = new THREE.Scene();
    const posts = new THREE.InstancedMesh(geometry, material, 2);
    for (const [index, x] of [-2, 2].entries()) {
      const transform = new THREE.Matrix4().makeScale(0.3, 2, 0.3);
      transform.setPosition(x, 1, 0);
      posts.setMatrixAt(index, transform);
    }
    scene.add(posts);
    for (const [y, width, height] of [
      [-0.12, 20, 0.24],
      [0.05, 5, 0.1],
      [2.2, 4.3, 0.2],
    ]) {
      const surface = new THREE.Mesh(geometry, material);
      surface.position.y = y;
      surface.scale.set(width, height, 1);
      scene.add(surface);
    }
    for (const property of ['visible', 'collision']) {
      const group = new THREE.Group();
      if (property === 'visible') group.visible = false;
      else group.userData.collision = 'none';
      const child = new THREE.Mesh(geometry, material);
      child.position.y = 0.5;
      group.add(child);
      scene.add(group);
      const direct = child.clone();
      if (property === 'visible') direct.visible = false;
      else direct.userData.collision = 'none';
      scene.add(direct);
    }

    const colliders = collectStaticColliders(scene);
    assert.equal(colliders.length, 2);
    assert.ok(colliders.every(({ minX, maxX }) => minX > 1.8 || maxX < -1.8));
    assert.ok(colliders.some(({ minX, maxX }) => minX < -2 && maxX > -2));
    assert.ok(colliders.some(({ minX, maxX }) => minX < 2 && maxX > 2));
  }
);
