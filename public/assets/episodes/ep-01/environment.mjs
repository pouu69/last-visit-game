/** Museum architecture and surface assets, authored in local coordinates with explicit clearance. */
export const MUSEUM_ENVIRONMENT_REVISION = 'museum-environment-2026-10-28';
export const MUSEUM_DOOR_CLEARANCE = Object.freeze({ width: 3.6, height: 2.3 });

export function createMuseumEnvironment(core) {
  const { THREE, paint: p, signal, waterPaint, geometry, material, mesh, box, group, finish } = core;
  // Thin adjoining tiles need square plan corners; a scaled unit bevel opens visible notches.
  const slabGeometry = geometry(new THREE.BoxGeometry(1, 1, 1));
  const slab = (parent, finishMaterial, position, size) => mesh(parent, slabGeometry, finishMaterial, position, size);
  const trailPaint = material('#5b8984', { transparent: true, opacity: 0.4, depthWrite: false });
  const doorWidth = MUSEUM_DOOR_CLEARANCE.width;
  const postHeight = MUSEUM_DOOR_CLEARANCE.height + 0.06;
  const physical = (position, size) => ({
    minX: position[0] - size[0] / 2, maxX: position[0] + size[0] / 2,
    minY: position[1] - size[1] / 2, maxY: position[1] + size[1] / 2,
    minZ: position[2] - size[2] / 2, maxZ: position[2] + size[2] / 2,
  });
  const floorColors = {
    gallery: p.tile, maintenance: p.dark, archive: p.edge, garden: p.green,
    office: p.wood, return: p.ink, control: p.dark, foyer: p.plaster, reception: p.edge,
  };
  function end(root, id, footprint, height, colliders = [], parts = {}) {
    const asset = finish(root, id, { footprint, height, colliders, parts, pivot: 'floor-center' });
    root.userData.assetRevision = MUSEUM_ENVIRONMENT_REVISION;
    return asset;
  }
  function dimensions(width, depth) {
    if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0)
      throw new RangeError('Environment dimensions must be positive finite numbers');
  }
  function floorPanels(root, width, depth, roomType, tone) {
    if (roomType === 'garden') return;
    if (roomType === 'office') {
      const count = Math.max(2, Math.ceil(width));
      const panelWidth = (width - 0.3) / count;
      for (let index = 0; index < count; index++)
        slab(root, p.wood, [-width / 2 + 0.15 + panelWidth * (index + 0.5), -0.008, 0], [panelWidth - 0.016, 0.016, depth - 0.3]);
      return;
    }
    const columns = Math.max(2, Math.ceil(width / 2)), rows = Math.max(2, Math.ceil(depth / 2));
    const tileWidth = (width - 0.3) / columns, tileDepth = (depth - 0.3) / rows;
    const darkRoom = ['maintenance', 'return', 'control'].includes(roomType);
    for (let x = 0; x < columns; x++) for (let z = 0; z < rows; z++) {
      const alternate = (x + z) % 2 === 0;
      slab(root, alternate ? tone : darkRoom ? p.ink : p.tile,
        [-width / 2 + 0.15 + tileWidth * (x + 0.5), -0.008, -depth / 2 + 0.15 + tileDepth * (z + 0.5)],
        [tileWidth - 0.018, 0.016, tileDepth - 0.018]);
    }
  }

  const builders = {
    'room-shell'({ width = 12, depth = 10, roomType = 'gallery', doors = ['north', 'south'], labelMaterial = p.green } = {}) {
      dimensions(width, depth);
      if (width < 4.4 || depth < 4.4) throw new RangeError('A museum room must fit the 3.6-unit doorway');
      if (!Array.isArray(doors) || doors.some((side) => !['north', 'south', 'west', 'east'].includes(side)))
        throw new TypeError('Room doors must name north, south, west or east');
      const root = group(`room-shell-${roomType}`), colliders = [], tone = floorColors[roomType] ?? p.tile;
      box(root, tone, [0, -0.14, 0], [width, 0.24, depth]);
      floorPanels(root, width, depth, roomType, tone);
      // The small floor border remains below the walking collision band.
      for (const z of [-depth / 2 + 0.1, depth / 2 - 0.1]) box(root, p.edge, [0, -0.003, z], [width - 0.2, 0.012, 0.075]);
      for (const x of [-width / 2 + 0.1, width / 2 - 0.1]) box(root, p.edge, [x, -0.003, 0], [0.075, 0.012, depth - 0.2]);
      for (const side of ['north', 'south', 'west', 'east']) {
        const horizontal = side === 'north' || side === 'south';
        const sign = side === 'north' || side === 'west' ? -1 : 1;
        const length = horizontal ? width : depth, boundary = sign * (horizontal ? depth : width) / 2;
        const height = side === 'north' ? 1.5 : 0.65, doorway = doors.includes(side);
        const pieces = doorway ? [[-(length + doorWidth) / 4, (length - doorWidth) / 2], [(length + doorWidth) / 4, (length - doorWidth) / 2]] : [[0, length]];
        for (const [center, span] of pieces) {
          const position = horizontal ? [center, height / 2, boundary] : [boundary, height / 2, center];
          const size = horizontal ? [span, height, 0.18] : [0.18, height, span];
          box(root, roomType === 'garden' ? p.wood : p.plaster, position, size);
          colliders.push(physical(position, horizontal ? [span, height, 0.23] : [0.23, height, span]));
          // A shallow lower panel is attached to both sides of the structural wall.
          for (const face of [-1, 1])
            box(root, p.green,
              horizontal ? [center, Math.min(0.27, height / 2), boundary + face * 0.103] : [boundary + face * 0.103, Math.min(0.27, height / 2), center],
              horizontal ? [Math.max(0.1, span - 0.12), Math.min(0.42, height - 0.12), 0.024] : [0.024, Math.min(0.42, height - 0.12), Math.max(0.1, span - 0.12)]);
          box(root, p.wood, [position[0], 0.055, position[2]], horizontal ? [span, 0.09, 0.23] : [0.23, 0.09, span]);
          box(root, p.brass, [position[0], height + 0.025, position[2]], horizontal ? [span, 0.05, 0.22] : [0.22, 0.05, span]);
        }
        if (!doorway) continue;
        box(root, p.brass, horizontal ? [0, 0.015, boundary] : [boundary, 0.015, 0], horizontal ? [3.5, 0.025, 0.18] : [0.18, 0.025, 3.5]);
        for (const edge of [-1.94, 1.94]) {
          const position = horizontal ? [edge, postHeight / 2, boundary] : [boundary, postHeight / 2, edge];
          const size = horizontal ? [0.22, postHeight, 0.3] : [0.3, postHeight, 0.22];
          box(root, p.dark, position, size);
          const footPosition = horizontal ? [edge, 0.22, boundary] : [boundary, 0.22, edge];
          const footSize = horizontal ? [0.28, 0.44, 0.32] : [0.32, 0.44, 0.28];
          box(root, p.brass, footPosition, footSize);
          colliders.push(physical(position, size));
          colliders.push(physical(footPosition, footSize));
        }
        box(root, p.wood, horizontal ? [0, postHeight, boundary] : [boundary, postHeight, 0], horizontal ? [4.1, 0.12, 0.28] : [0.28, 0.12, 4.1]);
        box(root, p.brass, horizontal ? [0, 2.44, boundary] : [boundary, 2.44, 0], horizontal ? [4.12, 0.035, 0.29] : [0.29, 0.035, 4.12]);
        box(root, tone, horizontal ? [0, 2.39, boundary] : [boundary, 2.39, 0], horizontal ? [0.6, 0.16, 0.31] : [0.31, 0.16, 0.6]);
      }
      const labelZ = depth / 2 - 1.2;
      box(root, p.brass, [0, 0.008, labelZ], [3.3, 0.024, 1.7]);
      const label = box(root, labelMaterial, [0, 0.029, labelZ], [3.2, 1.6, 0.016], [-Math.PI / 2, 0, 0]);
      label.name = 'room-floor-label'; label.userData.keepMesh = true;
      return end(root, 'room-shell', [width + 0.32, depth + 0.32], 2.48, colliders, { label });
    },

    'corridor-segment'({ width = 16, depth = 3.6 } = {}) {
      dimensions(width, depth);
      const root = group('museum-corridor'), horizontal = width > depth, span = horizontal ? 4 : 6, colliders = [];
      // The map rectangles overlap rooms; only the exposed gap needs a corridor floor mesh.
      const visibleWidth = horizontal ? span : width, visibleDepth = horizontal ? depth : span;
      box(root, p.ink, [0, -0.17, 0], [visibleWidth, 0.18, visibleDepth]);
      box(root, p.dark, [0, -0.067, 0], [visibleWidth - 0.04, 0.022, visibleDepth - 0.04]);
      for (const side of [-1, 1]) {
        const position = horizontal ? [0, 0.25, side * 1.8] : [side * 1.8, 0.25, 0];
        const size = horizontal ? [span, 0.5, 0.15] : [0.15, 0.5, span];
        box(root, p.edge, position, size);
        box(root, p.brass, [position[0], 0.52, position[2]], horizontal ? [span, 0.04, 0.17] : [0.17, 0.04, span]);
        box(root, p.green, horizontal ? [0, 0.24, side * 1.715] : [side * 1.715, 0.24, 0], horizontal ? [span - 0.08, 0.31, 0.025] : [0.025, 0.31, span - 0.08]);
        colliders.push(physical(position, size));
        box(root, signal, horizontal ? [0, -0.035, side * 1.5] : [side * 1.5, -0.035, 0], horizontal ? [span, 0.02, 0.025] : [0.025, 0.02, span]);
      }
      return end(root, 'corridor-segment', [visibleWidth, visibleDepth], 0.56, colliders);
    },

    'courtyard-path'() {
      const root = group('courtyard-stones');
      for (let x = -5; x <= 5; x++) for (let z = -4; z <= 4; z++)
        if ((x + z) % 2 === 0) box(root, p.edge, [x, 0.005, z], [0.9, 0.02, 0.9]);
      return end(root, 'courtyard-path', [10.9, 8.9], 0.02);
    },

    'water-channel'({ width = 0.35, depth = 7.3 } = {}) {
      dimensions(width, depth);
      const root = group('courtyard-water-channel');
      box(root, p.dark, [0, 0.006, 0], [width + 0.065, 0.023, depth]);
      for (const side of [-1, 1]) box(root, p.edge, [side * (width / 2 + 0.025), 0.022, 0], [0.035, 0.026, depth]);
      box(root, waterPaint, [0, 0.025, 0], [width, 0.02, depth - 0.02]);
      return end(root, 'water-channel', [width + 0.085, depth], 0.04);
    },

    'floor-rug'({ width = 4, depth = 2.4, tone = 'rust' } = {}) {
      dimensions(width, depth);
      if (width <= 0.2 || depth <= 0.2) throw new RangeError('A rug must fit its border');
      const root = group('museum-rug'), finishMaterial = p[tone] ?? p.rust;
      box(root, p.dark, [0, 0.012, 0], [width, 0.02, depth]);
      box(root, finishMaterial, [0, 0.026, 0], [width - 0.1, 0.012, depth - 0.1]);
      for (const z of [-depth / 2 + 0.09, depth / 2 - 0.09]) box(root, p.fold, [0, 0.035, z], [width - 0.22, 0.005, 0.018]);
      return end(root, 'floor-rug', [width, depth], 0.04);
    },

    'service-strip'({ width = 8, depth = 0.8 } = {}) {
      dimensions(width, depth);
      const root = group('control-service-strip');
      box(root, p.edge, [0, 0.02, 0], [width, 0.03, depth]);
      for (const z of [-depth / 2 + 0.05, depth / 2 - 0.05]) box(root, p.brass, [0, 0.038, z], [width - 0.08, 0.006, 0.026]);
      for (let index = 0; index < Math.floor(width / 0.5); index++)
        box(root, p.ink, [-width / 2 + 0.25 + index * 0.5, 0.039, 0], [0.15, 0.006, depth * 0.55], [0, -0.3, 0]);
      return end(root, 'service-strip', [width, depth], 0.045);
    },

    'wheel-trail'() {
      const root = group('wet-wheel-trail');
      for (let index = 0; index < 4; index++) for (const x of [0.3, 0.72])
        box(root, trailPaint, [x, 0.055, 0.4 - index * 0.24], [0.055, 0.006, 0.12], [0, -0.1, 0]);
      return end(root, 'wheel-trail', [0.8, 0.9], 0.06);
    },
  };
  return {
    revision: MUSEUM_ENVIRONMENT_REVISION,
    ids: Object.freeze(Object.keys(builders)),
    create(id, options = {}) {
      if (!Object.hasOwn(builders, id)) throw new Error(`Unknown museum environment asset ${id}`);
      return builders[id](options);
    },
  };
}
