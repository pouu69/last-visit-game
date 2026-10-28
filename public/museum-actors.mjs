/** Full-volume museum cast. All poses use Y up, +Z forward and floor-centred roots. */
export function createMuseumActors(core) {
  const {
    THREE, paint, signal, contact, material, geometry, box, cylinder, sphere,
    beam, ring, revolve, mesh, group, finish,
  } = core;
  const skin = material('#d9ad89', { roughness: 0.93 });
  const hair = material('#392f30', { roughness: 0.96 });
  const coat = material('#2e5555', { roughness: 0.94 });
  const orange = material('#bf704b', { roughness: 0.94 });
  const screenPaint = material('#698a7b', {
    roughness: 0.7, emissive: '#3b6658', emissiveIntensity: 0.24,
  });

  function plate(parent, finishMaterial, points, position, depth = 0.018) {
    const outline = new THREE.Shape();
    points.forEach(([x, y], index) => index ? outline.lineTo(x, y) : outline.moveTo(x, y));
    outline.closePath();
    return mesh(parent, geometry(new THREE.ExtrudeGeometry(outline, {
      depth, bevelEnabled: false, curveSegments: 1,
    })), finishMaterial, position, [1, 1, 1]);
  }

  function ground(parent, width, depth) {
    sphere(parent, contact, [0, 0.014, 0], [width, 0.013, depth]);
  }

  function moro() {
    const root = group('moro-guide-robot');
    // A bevelled porcelain shell, complete rear battery hatch and lateral wheel hubs.
    box(root, paint.green, [0, 0.3, 0], [0.55, 0.16, 0.46]);
    box(root, paint.plaster, [0, 0.61, 0], [0.62, 0.66, 0.52]);
    box(root, paint.edge, [0, 0.94, -0.02], [0.35, 0.035, 0.27]);
    for (const side of [-1, 1]) {
      cylinder(root, paint.dark, [side * 0.345, 0.19, -0.015], [0.19, 0.12, 0.19], [0, 0, Math.PI / 2]);
      cylinder(root, paint.brass, [side * 0.411, 0.19, -0.015], [0.095, 0.018, 0.095], [0, 0, Math.PI / 2]);
      cylinder(root, paint.green, [side * 0.423, 0.19, -0.015], [0.058, 0.016, 0.058], [0, 0, Math.PI / 2]);
      box(root, paint.brass, [side * 0.317, 0.48, -0.035], [0.026, 0.1, 0.16]);
    }
    // Dark glass is recessed behind the proud brass bezel; casing also exists behind it.
    box(root, paint.dark, [0, 0.735, 0.269], [0.48, 0.285, 0.026]);
    for (const side of [-1, 1]) {
      box(root, paint.brass, [side * 0.25, 0.735, 0.286], [0.026, 0.32, 0.05]);
      box(root, paint.brass, [0, 0.735 + side * 0.153, 0.286], [0.5, 0.026, 0.05]);
    }
    const eyes = group('moro-eyes');
    eyes.position.set(0, 0.745, 0.291);
    root.add(eyes);
    for (const x of [-0.105, 0.105])
      box(eyes, signal, [x, 0, 0], [0.038, 0.075, 0.015]);
    box(eyes, signal, [0, -0.083, 0], [0.08, 0.013, 0.012]);
    box(root, paint.green, [0, 0.46, 0.269], [0.26, 0.12, 0.025]);
    for (const x of [-0.07, 0, 0.07])
      box(root, paint.brass, [x, 0.46, 0.286], [0.023, 0.068, 0.012]);
    box(root, paint.green, [0, 0.57, -0.269], [0.41, 0.34, 0.027]);
    box(root, paint.brass, [0, 0.7, -0.287], [0.12, 0.028, 0.018]);
    for (const y of [0.48, 0.525, 0.57])
      box(root, paint.dark, [0, y, -0.287], [0.26, 0.015, 0.012]);
    cylinder(root, paint.brass, [0.31, 0.56, 0.09], [0.065, 0.035, 0.065], [0, 0, Math.PI / 2]);
    beam(root, paint.brass, [0.32, 0.56, 0.09], [0.48, 0.44, 0.29], 0.035);
    sphere(root, paint.wood, [0.48, 0.44, 0.29], [0.055, 0.055, 0.055]);
    beam(root, paint.brass, [0.48, 0.44, 0.29], [0.47, 0.54, 0.4], 0.022);
    beam(root, paint.brass, [0.48, 0.44, 0.29], [0.59, 0.49, 0.4], 0.022);
    box(root, paint.paper, [0.55, 0.46, 0.406], [0.12, 0.19, 0.015], [0, 0, -0.24]);
    const antenna = group('moro-antenna');
    antenna.position.set(-0.17, 0.95, -0.05);
    root.add(antenna);
    cylinder(antenna, paint.green, [0, 0.008, 0], [0.05, 0.035, 0.05]);
    beam(antenna, paint.brass, [0, 0.02, 0], [0, 0.16, 0], 0.013);
    const antennaLight = sphere(antenna, signal, [0, 0.18, 0], [0.032, 0.032, 0.032]);
    antennaLight.userData.keepMesh = true;
    ground(root, 0.46, 0.33);
    return finish(root, 'moro', {
      parts: { eyes, antenna, antennaLight }, footprint: [1.1, 0.75], height: 1.17,
      colliders: [],
    });
  }

  function curator() {
    const root = group('yunseo-curator');
    const body = group('curator-body');
    body.position.y = 1.03;
    root.add(body);
    revolve(body, coat, [
      [0, -0.42], [0.31, -0.42], [0.34, -0.36], [0.28, 0.36],
      [0.24, 0.46], [0.15, 0.51], [0, 0.51],
    ], [0, 0, 0], [1, 1, 0.77], 12);
    cylinder(body, skin, [0, 0.57, 0], [0.085, 0.18, 0.075]);
    cylinder(body, paint.paper, [0, 0.51, 0], [0.11, 0.09, 0.09]);
    box(body, paint.paper, [0, 0.33, 0.197], [0.17, 0.27, 0.045]);
    plate(body, coat, [[-0.21, 0.4], [-0.075, 0.13], [-0.022, 0.37]], [0, 0, 0.225]);
    plate(body, coat, [[0.21, 0.4], [0.075, 0.13], [0.022, 0.37]], [0, 0, 0.225]);
    box(body, paint.brass, [0.14, 0.14, 0.226], [0.12, 0.075, 0.025]);
    box(body, paint.paper, [0.14, 0.14, 0.243], [0.075, 0.026, 0.012]);
    for (const y of [-0.22, -0.04, 0.13])
      sphere(body, paint.brass, [0, y, 0.254], [0.016, 0.016, 0.01]);
    // Back yoke, belt and lower seam make the rear a designed view.
    box(body, paint.green, [0, 0.23, -0.218], [0.4, 0.07, 0.025]);
    box(body, paint.ink, [0, -0.08, -0.238], [0.34, 0.045, 0.02]);
    box(body, paint.ink, [0, -0.29, -0.25], [0.012, 0.18, 0.014]);
    const head = group('curator-head');
    head.position.y = 0.82;
    body.add(head);
    sphere(head, skin, [0, -0.005, 0.02], [0.215, 0.265, 0.19]);
    revolve(head, hair, [[0, 0.05], [0.22, 0.05], [0.24, 0.14], [0.19, 0.24], [0.07, 0.28], [0, 0.28]], [0, 0, -0.02], [1, 1, 0.88], 12);
    sphere(head, hair, [0, 0.04, -0.123], [0.218, 0.22, 0.12]);
    sphere(head, hair, [-0.1, 0.12, -0.22], [0.13, 0.13, 0.1]);
    for (const side of [-1, 1]) {
      sphere(head, skin, [side * 0.2, 0.01, 0.015], [0.043, 0.075, 0.05]);
      ring(head, paint.brass, [side * 0.086, 0.04, 0.202], 0.071, 0.01);
      sphere(head, paint.dark, [side * 0.086, 0.035, 0.194], [0.018, 0.024, 0.012]);
      beam(head, paint.brass, [side * 0.15, 0.05, 0.19], [side * 0.215, 0.055, -0.005], 0.009);
    }
    beam(head, paint.brass, [-0.018, 0.047, 0.208], [0.018, 0.047, 0.208], 0.009);
    sphere(head, skin, [0, -0.02, 0.202], [0.03, 0.047, 0.038]);
    beam(head, paint.rust, [-0.035, -0.108, 0.182], [0.035, -0.108, 0.182], 0.007);
    const arms = [], legs = [];
    for (const side of [-1, 1]) {
      const arm = group(`curator-arm-${side}`);
      arm.position.set(side * 0.31, 0.35, 0);
      body.add(arm);
      revolve(arm, coat, [[0, -0.4], [0.073, -0.4], [0.084, -0.1], [0.095, 0.03], [0, 0.06]], [side * 0.035, 0, 0], [1, 1, 0.95], 10);
      cylinder(arm, paint.paper, [side * 0.035, -0.407, 0], [0.069, 0.055, 0.069]);
      sphere(arm, skin, [side * 0.035, -0.49, 0.015], [0.071, 0.1, 0.063]);
      arm.rotation.z = side * 0.13;
      arms.push(arm);
      const leg = group(`curator-leg-${side}`);
      leg.position.set(side * 0.14, 0.68, 0);
      root.add(leg);
      box(leg, paint.dark, [0, -0.27, 0], [0.16, 0.55, 0.18]);
      box(leg, paint.wood, [0, -0.59, 0.065], [0.2, 0.12, 0.32]);
      box(leg, paint.dark, [0, -0.646, 0.065], [0.205, 0.025, 0.325]);
      legs.push(leg);
    }
    ground(root, 0.42, 0.31);
    return finish(root, 'curator', { parts: { body, head, arms, legs }, footprint: [1.0, 0.65], height: 2.15, colliders: [] });
  }

  function player() {
    const root = group('museum-visitor');
    revolve(root, orange, [[0, 0.37], [0.24, 0.37], [0.28, 0.42], [0.25, 0.85], [0.19, 0.96], [0, 0.98]], [0, 0, 0], [1, 1, 0.82], 12);
    box(root, paint.paper, [0, 0.9, 0.17], [0.13, 0.12, 0.04]);
    box(root, paint.brass, [0, 0.78, 0.226], [0.1, 0.08, 0.02]);
    box(root, paint.wood, [0, 0.58, 0.234], [0.014, 0.2, 0.012]);
    sphere(root, skin, [0, 1.115, 0.02], [0.21, 0.23, 0.19]);
    sphere(root, hair, [0, 1.26, -0.018], [0.224, 0.13, 0.2]);
    sphere(root, hair, [0, 1.145, -0.112], [0.205, 0.165, 0.1]);
    for (const side of [-1, 1]) {
      sphere(root, skin, [side * 0.2, 1.1, 0.012], [0.037, 0.06, 0.045]);
      sphere(root, paint.dark, [side * 0.075, 1.12, 0.197], [0.016, 0.022, 0.01]);
      beam(root, orange, [side * 0.24, 0.86, 0], [side * 0.3, 0.54, 0.02], 0.077);
      sphere(root, skin, [side * 0.305, 0.475, 0.035], [0.065, 0.084, 0.06]);
      // Shoulder straps wrap towards the rear bag rather than floating in the camera plane.
      beam(root, paint.dark, [side * 0.14, 0.89, 0.13], [side * 0.16, 0.97, -0.15], 0.022);
      box(root, paint.dark, [side * 0.16, 0.77, 0.205], [0.04, 0.26, 0.025]);
    }
    sphere(root, skin, [0, 1.075, 0.202], [0.025, 0.035, 0.029]);
    box(root, paint.dark, [0, 0.71, -0.24], [0.33, 0.4, 0.18]);
    box(root, paint.green, [0, 0.72, -0.34], [0.29, 0.31, 0.045]);
    box(root, paint.brass, [0, 0.69, -0.37], [0.065, 0.055, 0.02]);
    const legs = [];
    for (const x of [-0.13, 0.13]) {
      const leg = group(`visitor-leg-${x}`);
      leg.position.set(x, 0.4, 0);
      root.add(leg);
      box(leg, paint.dark, [0, -0.15, 0], [0.15, 0.31, 0.17]);
      box(leg, paint.wood, [0, -0.34, 0.05], [0.18, 0.12, 0.28]);
      box(leg, paint.dark, [0, -0.387, 0.05], [0.185, 0.023, 0.285]);
      legs.push(leg);
    }
    ground(root, 0.36, 0.3);
    return finish(root, 'player', { parts: { legs }, footprint: [0.76, 0.68], height: 1.4, colliders: [] });
  }

  function terminal() {
    const root = group('message-terminal');
    box(root, paint.wood, [0, 0.4, 0], [0.78, 0.75, 0.55]);
    box(root, paint.edge, [0, 0.055, 0], [0.84, 0.1, 0.6]);
    box(root, paint.brass, [0, 0.78, 0], [0.81, 0.055, 0.57]);
    box(root, paint.green, [0, 0.43, 0.282], [0.63, 0.5, 0.025]);
    box(root, paint.brass, [0, 0.46, 0.304], [0.17, 0.025, 0.025]);
    for (const side of [-1, 1]) {
      box(root, paint.brass, [side * 0.395, 0.43, 0], [0.026, 0.38, 0.28]);
      box(root, paint.ink, [side * 0.285, 0.4, -0.285], [0.04, 0.4, 0.025]);
    }
    cylinder(root, paint.brass, [0, 1.02, -0.035], [0.058, 0.43, 0.058]);
    cylinder(root, paint.green, [0, 0.845, -0.035], [0.115, 0.075, 0.115]);
    const screen = group('remote-screen');
    screen.position.set(0, 1.35, 0);
    root.add(screen);
    box(screen, paint.green, [0, 0, 0], [0.83, 1.1, 0.18]);
    box(screen, paint.dark, [0, 0, 0.097], [0.72, 0.98, 0.026]);
    box(screen, screenPaint, [0, 0, 0.116], [0.66, 0.9, 0.012]);
    for (const side of [-1, 1]) {
      box(screen, paint.brass, [side * 0.38, 0, 0.102], [0.025, 1.04, 0.035]);
      box(screen, paint.brass, [0, side * 0.513, 0.102], [0.76, 0.025, 0.035]);
    }
    box(screen, paint.wood, [0, 0, -0.105], [0.56, 0.75, 0.028]);
    for (const y of [-0.18, -0.1, -0.02, 0.06])
      box(screen, paint.dark, [0, y, -0.125], [0.36, 0.018, 0.016]);
    box(screen, paint.brass, [0, 0.22, -0.127], [0.18, 0.055, 0.02]);
    const portrait = group('remote-portrait');
    screen.add(portrait);
    sphere(portrait, hair, [0, 0.2, 0.147], [0.17, 0.22, 0.024]);
    sphere(portrait, skin, [0, 0.18, 0.169], [0.125, 0.16, 0.016]);
    sphere(portrait, hair, [-0.02, 0.3, 0.185], [0.14, 0.064, 0.012]);
    box(portrait, paint.rust, [0, -0.05, 0.152], [0.33, 0.18, 0.025]);
    for (const side of [-1, 1])
      sphere(portrait, paint.dark, [side * 0.043, 0.2, 0.187], [0.012, 0.016, 0.006]);
    const dots = group('message-dots');
    screen.add(dots);
    for (const x of [-0.1, 0, 0.1])
      sphere(dots, paint.paper, [x, -0.29, 0.137], [0.024, 0.024, 0.009]);
    box(screen, paint.paper, [0, -0.4, 0.133], [0.44, 0.014, 0.012]);
    return finish(root, 'terminal', {
      parts: { screen, portrait, dots }, footprint: [0.84, 0.62], height: 1.94,
      colliders: [{ minX: -0.42, maxX: 0.42, minY: 0.05, maxY: 0.82, minZ: -0.3, maxZ: 0.3 }],
    });
  }

  const builders = { moro, curator, player, terminal };
  return {
    screenMaterial: screenPaint,
    ids: Object.freeze(Object.keys(builders)),
    create(id) {
      const build = builders[id];
      if (!build) throw new RangeError(`Unknown museum actor asset: ${id}`);
      return build();
    },
  };
}
