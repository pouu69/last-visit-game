/**
 * Snapshot visible physical meshes as frozen world-space footprints in the walking band.
 * Mark a mesh or ancestor with userData.collision = 'none' to exclude its entire subtree.
 * Call after final placement; moving objects need their own collision representation.
 */
export function collectStaticColliders(root) {
  root.updateMatrixWorld(true);
  const colliders = [];

  function append(mesh, matrix, id) {
    const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
    if (bounds.isEmpty() || bounds.max.y < 0.12 || bounds.min.y > 1.65) return;
    colliders.push(
      Object.freeze({
        id,
        minX: bounds.min.x,
        maxX: bounds.max.x,
        minZ: bounds.min.z,
        maxZ: bounds.max.z,
      })
    );
  }

  function visit(object) {
    if (!object.visible || object.userData.collision === 'none') return;
    if (object.isMesh) {
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      if (object.isInstancedMesh) {
        const instance = object.matrixWorld.clone();
        for (let index = 0; index < object.count; index += 1) {
          object.getMatrixAt(index, instance);
          append(
            object,
            object.matrixWorld.clone().multiply(instance),
            `${object.uuid}:${index}`
          );
        }
      } else {
        append(object, object.matrixWorld, object.uuid);
      }
    }
    for (const child of object.children) visit(child);
  }

  visit(root);
  return Object.freeze(colliders);
}
