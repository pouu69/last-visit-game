// Shared by the server's arrival gate and the browser's floor, movement, and map.
export const ROOMS = Object.freeze(
  [
    {
      id: 'maintenance',
      label: '정비 통로',
      x: -16,
      z: -16,
      width: 16,
      depth: 14,
      spawn: [-16, -13],
    },
    { id: 'return', label: '반환실', x: 0, z: -16, width: 16, depth: 14, spawn: [0, -13] },
    {
      id: 'control',
      label: '인양 제어실',
      x: 16,
      z: -16,
      width: 16,
      depth: 14,
      spawn: [16, -13],
    },
    { id: 'archive', label: '기록실', x: -16, z: 0, width: 16, depth: 14, spawn: [-16, 3] },
    { id: 'gallery', label: '제1 전시실', x: 0, z: 0, width: 16, depth: 14, spawn: [0, 3] },
    { id: 'office', label: '관장실', x: 16, z: 0, width: 16, depth: 14, spawn: [16, 3] },
    { id: 'garden', label: '안뜰', x: -16, z: 16, width: 16, depth: 14, spawn: [-16, 19] },
    { id: 'foyer', label: '중앙 로비', x: 0, z: 16, width: 16, depth: 14, spawn: [0, 19] },
    {
      id: 'reception',
      label: '반환 접수실',
      x: 16,
      z: 16,
      width: 16,
      depth: 14,
      spawn: [16, 19],
    },
  ].map((room) => Object.freeze({ ...room, spawn: Object.freeze(room.spawn) }))
);

export const CONNECTIONS = Object.freeze(
  [
    ['maintenance', 'return'],
    ['return', 'control'],
    ['archive', 'gallery'],
    ['gallery', 'office'],
    ['garden', 'foyer'],
    ['foyer', 'reception'],
    ['maintenance', 'archive'],
    ['archive', 'garden'],
    ['return', 'gallery'],
    ['gallery', 'foyer'],
    ['control', 'office'],
    ['office', 'reception'],
  ].map(Object.freeze)
);

export const CORRIDORS = Object.freeze(
  CONNECTIONS.map(([from, to]) => {
    const a = ROOMS.find((room) => room.id === from);
    const b = ROOMS.find((room) => room.id === to);
    return Object.freeze({
      from,
      to,
      x: (a.x + b.x) / 2,
      z: (a.z + b.z) / 2,
      width: a.x === b.x ? 3.6 : Math.abs(a.x - b.x),
      depth: a.z === b.z ? 3.6 : Math.abs(a.z - b.z),
    });
  })
);

export const SCENE_ROOMS = Object.freeze({
  O00: 'foyer',
  S01: 'gallery',
  I01: 'maintenance',
  I02: 'archive',
  I03: 'garden',
  I04: 'office',
  P11: 'archive',
  P12: 'foyer',
  S12: 'return',
  T21: 'return',
  T22: 'return',
  D21: 'return',
  D22: 'garden',
  S22: 'return',
  P21: 'control',
  R31: 'return',
  R32: 'return',
  S31: 'reception',
  F31: 'reception',
  F32: 'archive',
  F33: 'maintenance',
  F34: 'foyer',
});

/** Endings remain where the final action happened. */
export function sceneRoomId(sceneId) {
  return SCENE_ROOMS[sceneId] ?? null;
}

export function roomAt(x, z) {
  return (
    ROOMS.find(
      (room) => Math.abs(x - room.x) <= room.width / 2 && Math.abs(z - room.z) <= room.depth / 2
    )?.id ?? null
  );
}

export function spawnForRoom(roomId) {
  const room = ROOMS.find((item) => item.id === roomId);
  if (!room) throw new Error(`Unknown museum room ${roomId}; use a room from ROOMS.`);
  return [...room.spawn];
}

const floorAreas = [...ROOMS, ...CORRIDORS].map((area) => ({
  minX: area.x - area.width / 2,
  maxX: area.x + area.width / 2,
  minZ: area.z - area.depth / 2,
  maxZ: area.z + area.depth / 2,
}));

function insideFloor(x, z) {
  return floorAreas.some(
    (area) => x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ
  );
}

function buildFloorBoundary() {
  const xs = [...new Set(floorAreas.flatMap((area) => [area.minX, area.maxX]))].sort(
    (a, b) => a - b
  );
  const zs = [...new Set(floorAreas.flatMap((area) => [area.minZ, area.maxZ]))].sort(
    (a, b) => a - b
  );
  const cells = xs
    .slice(0, -1)
    .map((x, i) =>
      zs.slice(0, -1).map((z, j) => insideFloor((x + xs[i + 1]) / 2, (z + zs[j + 1]) / 2))
    );
  const boundary = [];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < zs.length - 1; j += 1) {
      if (!cells[i][j]) continue;
      const minX = xs[i],
        maxX = xs[i + 1],
        minZ = zs[j],
        maxZ = zs[j + 1];
      if (!cells[i - 1]?.[j]) boundary.push({ minX, maxX: minX, minZ, maxZ });
      if (!cells[i + 1]?.[j]) boundary.push({ minX: maxX, maxX, minZ, maxZ });
      if (!cells[i][j - 1]) boundary.push({ minX, maxX, minZ, maxZ: minZ });
      if (!cells[i][j + 1]) boundary.push({ minX, maxX, minZ: maxZ, maxZ });
    }
  }
  return boundary;
}

// Interior rectangle edges are doors, not walls; only the union's exposed edges constrain a body.
const floorBoundary = buildFloorBoundary();

/** A closed circular footprint stays in the floor union. Invalid coordinates/radii return false. */
export function walkableAt(x, z, radius = 0.25) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius) || radius < 0)
    return false;
  if (!insideFloor(x, z)) return false;
  return floorBoundary.every((edge) => {
    const dx = Math.max(edge.minX - x, 0, x - edge.maxX);
    const dz = Math.max(edge.minZ - z, 0, z - edge.maxZ);
    // Preserve tangency despite subtraction roundoff at the museum's world coordinates.
    return Math.hypot(dx, dz) + Number.EPSILON * 64 >= radius;
  });
}
