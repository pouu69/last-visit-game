/**
 * Snapshot visible physical meshes as frozen world-space footprints in the walking band.
 * Mark a mesh or ancestor with userData.collision = 'none' to exclude its entire subtree.
 * Call after final placement; moving objects need their own collision representation.
 */
export function collectStaticColliders(root) {
  root.updateMatrixWorld(true);
  const colliders = [];

  function appendBounds(localBounds, matrix, id, ceiling) {
    const bounds = localBounds.clone().applyMatrix4(matrix);
    if (bounds.isEmpty()) return;
    appendWorldBounds(bounds.min, bounds.max, id, ceiling);
  }

  function appendWorldBounds(min, max, id, ceiling = 1.65) {
    if (max.y < 0.12 || min.y > ceiling) return;
    colliders.push(
      Object.freeze({
        id,
        minX: min.x,
        maxX: max.x,
        minZ: min.z,
        maxZ: max.z,
      })
    );
  }

  function visit(object) {
    if (!object.visible || object.userData.collision === 'none') return;
    const ceiling = object.userData.collisionCeiling ?? 1.65;
    // Authored asset proxies preserve holes and passable clearances after render meshes merge.
    // An empty proxy list intentionally makes the whole asset visual-only.
    if (Array.isArray(object.userData.assetColliders)) {
      for (const [index, proxy] of object.userData.assetColliders.entries()) {
        const min = object.position.clone().set(Infinity, Infinity, Infinity);
        const max = object.position.clone().set(-Infinity, -Infinity, -Infinity);
        const point = object.position.clone();
        for (const x of [proxy.minX, proxy.maxX])
          for (const y of [proxy.minY, proxy.maxY])
            for (const z of [proxy.minZ, proxy.maxZ]) {
              point.set(x, y, z).applyMatrix4(object.matrixWorld);
              min.min(point);
              max.max(point);
            }
        appendWorldBounds(min, max, `${object.uuid}:proxy:${index}`, ceiling);
      }
      return;
    }
    if (object.isMesh) {
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      if (object.isInstancedMesh) {
        const instance = object.matrixWorld.clone();
        for (let index = 0; index < object.count; index += 1) {
          object.getMatrixAt(index, instance);
          appendBounds(
            object.geometry.boundingBox,
            object.matrixWorld.clone().multiply(instance),
            `${object.uuid}:${index}`,
            ceiling
          );
        }
      } else {
        appendBounds(object.geometry.boundingBox, object.matrixWorld, object.uuid, ceiling);
      }
    }
    for (const child of object.children) visit(child);
  }

  visit(root);
  return Object.freeze(colliders);
}
