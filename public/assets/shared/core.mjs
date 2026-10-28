/** Camera-independent geometry shared by the museum object catalogue. */
export const MUSEUM_ASSET_REVISION = 'museum-low-poly-2026-10-28';
export const MUSEUM_PALETTE = Object.freeze({
  plaster: '#e4dfc8', edge: '#c3b99c', paper: '#fff2c7', fold: '#c6aa78',
  wood: '#704f40', brass: '#b18a54', green: '#486252', dark: '#243b37',
  tile: '#ddd6bd', ink: '#46594e', water: '#548a88', rust: '#9f5844',
});

export function createAssetCore(THREE, resources) {
  const { geometry, material, paint, glass, signal, waterPaint, contact } = resources;
  const outline = new THREE.Shape();
  outline.moveTo(-0.46, -0.46);
  outline.lineTo(0.46, -0.46);
  outline.lineTo(0.46, 0.46);
  outline.lineTo(-0.46, 0.46);
  outline.closePath();
  const cube = geometry(new THREE.ExtrudeGeometry(outline, {
    depth: 0.92, bevelEnabled: true, bevelThickness: 0.04,
    bevelSize: 0.04, bevelSegments: 1, steps: 1, curveSegments: 1,
  }));
  cube.translate(0, 0, -0.46);
  const mappedCube = geometry(new THREE.BoxGeometry(1, 1, 1));
  const round = geometry(new THREE.CylinderGeometry(1, 1, 1, 12));
  const globe = geometry(new THREE.SphereGeometry(1, 12, 8));
  const ringCache = new Map();

  function group(name) {
    const value = new THREE.Group();
    value.name = name;
    return value;
  }
  function mesh(parent, shape, finish, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const value = new THREE.Mesh(shape, finish);
    value.position.set(...position);
    value.scale.set(...scale);
    value.rotation.set(...rotation);
    parent.add(value);
    return value;
  }
  // Label slabs need BoxGeometry's normalized UVs; extrusion cap UVs use shape coordinates.
  const box = (parent, finish, position, scale, rotation) => mesh(parent, finish.map ? mappedCube : cube, finish, position, scale, rotation);
  const cylinder = (parent, finish, position, scale, rotation) => mesh(parent, round, finish, position, scale, rotation);
  const sphere = (parent, finish, position, scale, rotation) => mesh(parent, globe, finish, position, scale, rotation);
  function beam(parent, finish, start, end, radius) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const value = cylinder(parent, finish, a.clone().add(b).multiplyScalar(0.5).toArray(), [radius, a.distanceTo(b), radius]);
    value.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    return value;
  }
  function ring(parent, finish, position, radius, tube, rotation = [0, 0, 0]) {
    const key = `${radius}:${tube}`;
    if (!ringCache.has(key)) ringCache.set(key, geometry(new THREE.TorusGeometry(radius, tube, 6, 16)));
    return mesh(parent, ringCache.get(key), finish, position, [1, 1, 1], rotation);
  }
  function revolve(parent, finish, points, position = [0, 0, 0], scale = [1, 1, 1], segments = 12) {
    const shape = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
    // Lathe's zero-radius end rings emit duplicate pole triangles; retain only real cap fans.
    const p = shape.getAttribute('position'), indices = shape.index, retained = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < indices.count; i += 3) {
      const ia = indices.getX(i), ib = indices.getX(i + 1), ic = indices.getX(i + 2);
      a.fromBufferAttribute(p, ia); b.fromBufferAttribute(p, ib); c.fromBufferAttribute(p, ic);
      if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18) retained.push(ia, ib, ic);
    }
    shape.setIndex(retained);
    return mesh(parent, geometry(shape), finish, position, scale);
  }

  /** Merge static children in their local frame; named pivots and changing meshes retain ownership. */
  function compact(parent) {
    for (const child of [...parent.children]) if (child.isGroup && !child.userData.assetId) compact(child);
    const buckets = new Map();
    for (const child of parent.children) {
      if (!child.isMesh || child.isInstancedMesh || child.userData.keepMesh || Array.isArray(child.material)) continue;
      if (!buckets.has(child.material)) buckets.set(child.material, []);
      buckets.get(child.material).push(child);
    }
    for (const [finish, children] of buckets) {
      if (children.length < 2) continue;
      const positions = [], normals = [], uvs = [];
      for (const child of children) {
        child.updateMatrix();
        const shape = child.geometry;
        const p = shape.getAttribute('position'), n = shape.getAttribute('normal'), uv = shape.getAttribute('uv');
        const indices = shape.index;
        const count = indices ? indices.count : p.count;
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(child.matrix);
        const vector = new THREE.Vector3();
        for (let i = 0; i < count; i++) {
          const j = indices ? indices.getX(i) : i;
          vector.fromBufferAttribute(p, j).applyMatrix4(child.matrix);
          positions.push(vector.x, vector.y, vector.z);
          if (n) vector.fromBufferAttribute(n, j).applyMatrix3(normalMatrix).normalize();
          else vector.set(0, 1, 0);
          normals.push(vector.x, vector.y, vector.z);
          uvs.push(uv ? uv.getX(j) : 0, uv ? uv.getY(j) : 0);
        }
      }
      const shape = geometry(new THREE.BufferGeometry());
      shape.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      shape.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      shape.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      shape.computeBoundingBox();
      shape.computeBoundingSphere();
      const combined = mesh(parent, shape, finish);
      combined.name = `surface-${finish.color?.getHexString() ?? finish.type}`;
      for (const child of children) child.removeFromParent();
    }
  }
  function finish(value, id, { parts = {}, footprint = [1, 1], height = 1, colliders = [], pivot = 'floor-center' } = {}) {
    compact(value);
    value.userData.assetId = id;
    value.userData.assetRevision = MUSEUM_ASSET_REVISION;
    value.userData.assetColliders = colliders;
    value.userData.assetPivot = pivot;
    return { group: value, parts, footprint, height, pivot, collision: colliders };
  }
  return { THREE, paint, glass, signal, waterPaint, contact, geometry, material, box, cylinder, sphere, beam, ring, revolve, mesh, group, finish };
}
