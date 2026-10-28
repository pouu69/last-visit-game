/** Complete low-poly museum props. All geometry is local and independent of the camera. */
export function createMuseumProps(core) {
  const { THREE, paint: p, glass, signal, waterPaint, geometry, box, cylinder, sphere, beam, ring, revolve, mesh, group, finish } = core;
  const physical = (w, d, h, x = 0, z = 0, y = 0) => ({ minX: x - w / 2, maxX: x + w / 2, minY: y, maxY: y + h, minZ: z - d / 2, maxZ: z + d / 2 });
  const supportProps = new Set(['paper-boat', 'ledger', 'sealed-cover', 'original-guard', 'stamp-set', 'key-bundle', 'layered-label', 'preservation-kit', 'document-tray']);
  const end = (g, id, w, d, h, parts = {}, colliders = []) => finish(g, id, {
    footprint: [w, d], height: h, parts, colliders,
    pivot: supportProps.has(id) ? 'support-center' : id === 'battery' ? 'body-center' : id === 'clock' ? 'wall-center' : id === 'invitation' ? 'panel-center' : 'floor-center',
  });
  const keep = (m) => { m.userData.keepMesh = true; return m; };

  function table(g, w, d, top = 0.88) {
    box(g, p.wood, [0, top - 0.06, 0], [w, 0.12, d]);
    for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) {
      for (const z of [-d / 2 + 0.1, d / 2 - 0.1]) {
        box(g, p.wood, [x, (top - 0.13) / 2, z], [0.12, top - 0.13, 0.12]);
        box(g, p.brass, [x, 0.045, z], [0.13, 0.09, 0.13]);
      }
      box(g, p.wood, [x, top - 0.19, 0], [0.08, 0.17, d - 0.16]);
    }
    for (const z of [-d / 2 + 0.09, d / 2 - 0.09]) box(g, p.wood, [0, top - 0.19, z], [w - 0.16, 0.17, 0.08]);
  }
  function corners(g, w, d, y) {
    for (const x of [-w / 2 + 0.055, w / 2 - 0.055]) for (const z of [-d / 2 + 0.055, d / 2 - 0.055]) box(g, p.brass, [x, y, z], [0.11, 0.1, 0.11]);
  }
  function lamp(g, x, y, z) {
    revolve(g, p.brass, [[0, 0], [.14, 0], [.16, .035], [.12, .065], [0, .065]], [x, y, z]);
    beam(g, p.brass, [x, y + .05, z], [x, y + .43, z], .023);
    beam(g, p.brass, [x, y + .43, z], [x + .12, y + .5, z], .023);
    revolve(g, p.green, [[0, .15], [.07, .14], [.2, .025], [.2, 0], [.165, 0], [.055, .115], [0, .12]], [x + .12, y + .36, z]);
    cylinder(g, p.brass, [x + .12, y + .365, z], [.16, .012, .16]);
  }
  function papers(g, x, y, z) {
    for (let i = 0; i < 3; i++) box(g, p.paper, [x + i * .012, y + i * .016, z], [.53, .012, .34], [0, -.1 + i * .02, 0]);
  }
  function thinTriangle(g, points, finishMaterial, thickness = .014) {
    const a = new THREE.Vector3(...points[0]), b = new THREE.Vector3(...points[1]), c = new THREE.Vector3(...points[2]);
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize().multiplyScalar(thickness / 2);
    const vertices = [a.clone().add(n), b.clone().add(n), c.clone().add(n), a.clone().sub(n), b.clone().sub(n), c.clone().sub(n)];
    const faces = [[0,1,2],[5,4,3],[0,3,4],[0,4,1],[1,4,5],[1,5,2],[2,5,3],[2,3,0]];
    const shape = geometry(new THREE.BufferGeometry());
    shape.setAttribute('position', new THREE.Float32BufferAttribute(faces.flatMap(f => f.flatMap(i => vertices[i].toArray())), 3));
    shape.computeVertexNormals();
    mesh(g, shape, finishMaterial);
  }

  const builders = {
    'exhibit-case'() {
      const g = group('empty-exhibit');
      box(g, p.wood, [0,.13,0], [1.76,.22,1.4]);
      box(g, p.green, [0,.64,0], [1.58,.82,1.22]);
      box(g, p.edge, [0,1.1,0], [1.8,.12,1.42]);
      box(g, p.wood, [0,1.18,0], [.96,.045,.57]);
      for (const x of [-.76,.76]) for (const z of [-.59,.59]) {
        cylinder(g, p.brass, [x,1.67,z], [.024,1.04,.024]);
        sphere(g,p.brass,[x,2.2,z],[.035,.035,.035]);
      }
      for (const y of [1.17,2.18]) {
        for (const z of [-.59,.59]) box(g,p.brass,[0,y,z],[1.55,.027,.03]);
        for (const x of [-.76,.76]) box(g,p.brass,[x,y,0],[.03,.027,1.2]);
      }
      for (const z of [-.59,.59]) box(g,glass,[0,1.67,z],[1.5,1,.012]);
      for (const x of [-.76,.76]) box(g,glass,[x,1.67,0],[.012,1,1.16]);
      box(g,glass,[0,2.18,0],[1.5,.012,1.16]);
      box(g,p.brass,[0,.82,.619],[.65,.23,.03]);
      box(g,p.wood,[.67,1.62,.619],[.1,.16,.03]);
      sphere(g,p.dark,[.67,1.62,.642],[.013,.022,.009]);
      for (const x of [-1.1,1.1]) {
        cylinder(g,p.brass,[x,.33,1.08],[.03,.6,.03]);
        cylinder(g,p.wood,[x,.035,1.08],[.16,.05,.16]);
      }
      beam(g,p.rust,[-1.1,.64,1.08],[0,.48,1.08],.026);
      beam(g,p.rust,[0,.48,1.08],[1.1,.64,1.08],.026);
      return end(g,'exhibit-case',2.52,1.95,2.23,{},[physical(1.8,1.42,2.2),physical(2.52,.32,.66,0,1.08)]);
    },
    'archive-desk'() {
      const g = group('archive-desk'); table(g,1.65,.85,.93);
      box(g,p.green,[0,.72,.32],[1.26,.2,.15]);
      box(g,p.brass,[0,.72,.41],[.25,.033,.035]);
      papers(g,-.3,.95,-.03); lamp(g,-.52,.94,-.23);
      box(g,p.green,[.34,.965,.12],[.45,.05,.33],[0,.1,0]);
      box(g,p.paper,[.34,1,.12],[.4,.02,.29],[0,.1,0]);
      return end(g,'archive-desk',1.65,.85,1.5,{},[physical(1.65,.85,.93)]);
    },
    courtyard() {
      const g=group('courtyard-planter');
      box(g,p.dark,[0,.12,0],[2.9,.2,1.28]);
      for(const z of [-.72,.72]) box(g,p.edge,[0,.25,z],[3.25,.45,.14]);
      for(const x of [-1.56,1.56]) box(g,p.edge,[x,.25,0],[.14,.45,1.58]);
      for(const z of [-.74,.74]) for(let i=0;i<7;i++) box(g,p.plaster,[-1.37+i*.455,.26,z+.008],[.41,.38,.032]);
      for (let i=0;i<14;i++) {
        const angle=i*2.4, x=Math.sin(angle)*.85, z=Math.cos(angle)*.32;
        const leaf=group(`folded-leaf-${i}`);g.add(leaf);leaf.position.set(x,.3,z);leaf.rotation.set(.1,angle,Math.sin(angle)*.25);
        const height=.55+(i%4)*.13;
        thinTriangle(leaf,[[0,0,0],[-.2,height*.55,.03],[0,height,.12]],p.green,.025);
        thinTriangle(leaf,[[0,0,0],[0,height,.12],[.21,height*.48,.03]],i%3?p.ink:p.green,.025);
      }
      const drain=group('drain'); drain.position.set(2.7,0,.18);g.add(drain);
      box(drain,p.dark,[0,.04,0],[.45,.07,1.25]);
      for(let i=0;i<8;i++) box(drain,p.brass,[0,.09,-.52+i*.15],[.4,.035,.035]);
      return end(g,'courtyard',4.56,1.6,1.3,{},[physical(3.25,1.6,.48)]);
    },
    'storage-bays'() {
      const g=group('storage-bays');
      box(g,p.dark,[0,.09,0],[2.8,.16,3.7]);
      for(const x of [-1.4,1.4]) box(g,p.edge,[x,.28,0],[.16,.48,3.7]);
      box(g,p.edge,[0,.28,-1.85],[2.95,.48,.16]);
      box(g,p.brass,[0,.33,1.84],[2.95,.62,.11]);
      box(g,glass,[0,1,1.84],[2.78,.75,.025]);
      box(g,p.brass,[0,1.39,1.84],[2.95,.045,.07]);
      const water=keep(box(g,waterPaint,[0,.26,-.02],[2.62,.04,3.43]));
      for(const z of [-1.12,.65]) {
        box(g,p.wood,[-.02,.47,z],[1.7,.18,1.02]);
        box(g,p.edge,[-.02,.6,z],[1.62,.08,.94]);
        for(const x of [-.78,.74]) box(g,p.brass,[x,.5,z],[.035,.19,1.03]);
      }
      for(const z of [-1.75,1.4]) {
        box(g,p.wood,[1.08,1.18,z],[.12,2.15,.12]);
        box(g,p.brass,[0,2.25,z],[2.2,.11,.13]);
      }
      box(g,p.wood,[0,2.31,-.16],[.14,.14,3.38]);
      cylinder(g,p.brass,[0,2.15,-.25],[.19,.14,.19],[Math.PI/2,0,0]);
      beam(g,p.dark,[0,2.1,-.25],[0,1.45,-.25],.017);
      const hook=new THREE.CatmullRomCurve3([[0,1.47,-.25],[0,1.27,-.25],[.15,1.24,-.25],[.22,1.36,-.25]].map(v=>new THREE.Vector3(...v)));
      mesh(g,geometry(new THREE.TubeGeometry(hook,12,.028,6,false)),p.brass);
      return end(g,'storage-bays',3,3.9,2.4,{water},[physical(2.95,3.9,1.4)]);
    },
    'paper-boat'({damaged=false}={}) {
      const g=group(damaged?'damaged-paper-boat':'paper-boat');
      // Outer hull and central fold are distinct surfaces, with an actual open cavity between.
      const rim=[[-.83,.25,0],[-.44,.3,.34],[.44,.3,.34],damaged?[.59,.15,.04]:[.83,.25,0],[.44,.3,-.34],[-.44,.3,-.34]];
      const chine=[[-.58,.1,0],[-.32,.025,.14],[.32,.025,.14],damaged?[.46,.07,.02]:[.58,.1,0],[.32,.025,-.14],[-.32,.025,-.14]];
      for(let i=0;i<rim.length;i++) {
        const next=(i+1)%rim.length;
        thinTriangle(g,[rim[i],rim[next],chine[next]],i===0||i===3?p.fold:p.paper);
        thinTriangle(g,[rim[i],chine[next],chine[i]],p.paper);
        thinTriangle(g,[chine[i],chine[next],[0,.018,0]],p.paper);
        beam(g,p.fold,rim[i],rim[next],.008);
      }
      const apex=[0,.52,0], fold=[[-.43,.08,.1],[.43,.08,.1],[.43,.08,-.1],[-.43,.08,-.1]];
      for(let i=0;i<fold.length;i++) thinTriangle(g,[fold[i],fold[(i+1)%fold.length],apex],i===2?p.fold:p.paper);
      beam(g,p.fold,fold[0],apex,.008);beam(g,p.fold,apex,fold[1],.008);
      if(damaged) {
        const a=new THREE.Vector3(...rim[2]),b=new THREE.Vector3(...rim[3]),c=new THREE.Vector3(...chine[3]);
        const outward=new THREE.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();
        if(outward.z<0) outward.negate();
        const mark=[[.3,.6,.1],[.1,.75,.15],[.15,.45,.4]].map(([wa,wb,wc])=>a.clone().multiplyScalar(wa).addScaledVector(b,wb).addScaledVector(c,wc).addScaledVector(outward,.012).toArray());
        thinTriangle(g,mark,p.rust,.016);
      }
      return end(g,'paper-boat',1.68,.7,.54);
    },
    ledger({blurred=false}={}) {
      const g=group(blurred?'blurred-ledger':'ledger');
      box(g,p.green,[0,.025,0],[.94,.05,.65]);
      box(g,paper(blurred),[.015,.085,0],[.85,.08,.59]);
      box(g,p.green,[-.44,.08,0],[.06,.13,.65]);
      for(const z of [-.21,.21]) box(g,p.brass,[-.44,.08,z],[.065,.055,.06]);
      if(blurred) for(let i=0;i<3;i++) sphere(g,p.ink,[-.1+i*.14,.129,-.1+(i%2)*.2],[.14,.006,.09]);
      else for(let i=0;i<4;i++) box(g,p.ink,[.1,.128,-.16+i*.105],[.44,.003,.012]);
      box(g,p.rust,[-.2,.14,0],[.035,.014,.55]);
      return end(g,'ledger',.95,.66,.17);
    },
    'sealed-cover'() {
      const g=group('sealed-cover');box(g,p.green,[0,.22,0],[1.65,.44,.95]);box(g,p.edge,[0,.47,0],[1.7,.06,1]);
      for(const x of [-.7,.7]) box(g,p.brass,[x,.25,0],[.055,.46,.97]);
      box(g,p.paper,[0,.51,0],[.18,.016,1]);box(g,p.rust,[0,.526,.1],[.13,.02,.18]);
      return end(g,'sealed-cover',1.7,1,.54);
    },
    'original-guard'() {
      const g=group('locked-original-cover');
      for(const x of [-.79,.79]) for(const z of [-.45,.45]) box(g,p.brass,[x,.27,z],[.03,.54,.03]);
      for(const z of [-.45,.45]) {box(g,glass,[0,.27,z],[1.56,.52,.018]);box(g,p.brass,[0,.55,z],[1.62,.03,.035]);}
      for(const x of [-.79,.79]) {box(g,glass,[x,.27,0],[.018,.52,.88]);box(g,p.brass,[x,.55,0],[.035,.03,.94]);}
      box(g,glass,[0,.55,0],[1.56,.018,.88]);box(g,p.wood,[0,.27,.48],[.13,.18,.035]);box(g,p.brass,[0,.27,.505],[.06,.08,.02]);
      return end(g,'original-guard',1.64,.97,.58);
    },
    trolley() {
      const g=group('moro-trolley');box(g,p.wood,[0,.13,0],[1.04,.1,.75]);
      for(const x of [-.42,.42]) for(const z of [-.27,.27]) {cylinder(g,p.dark,[x,.065,z],[.075,.08,.075],[0,0,Math.PI/2]);cylinder(g,p.brass,[x*1.1,.065,z],[.035,.02,.035],[0,0,Math.PI/2]);}
      for(const x of [-.47,.47]) beam(g,p.brass,[x,.17,-.31],[x,.74,-.49],.026);
      beam(g,p.brass,[-.47,.74,-.49],[.47,.74,-.49],.026);
      return end(g,'trolley',1.1,1,.78);
    },
    'notice-board'({faceMaterial=p.paper}={}) {
      const g=group('notice-board');
      for(const x of [-.48,.48]) {box(g,p.wood,[x,.65,0],[.09,1.3,.12]);box(g,p.brass,[x,.05,0],[.15,.08,.3]);}
      box(g,p.green,[0,1.5,0],[1.35,1.18,.12]);
      for(const x of [-.65,.65]) box(g,p.wood,[x,1.5,.01],[.085,1.28,.15]);
      for(const y of [.9,2.1]) box(g,p.wood,[0,y,.01],[1.38,.085,.15]);
      const face=keep(box(g,faceMaterial,[0,1.5,.081],[1.2,1.03,.014]));face.name='board-face';
      const diagram=group('board-diagram');g.add(diagram);
      for(const x of [-.4,0,.4]) box(diagram,p.ink,[x,1.55,.102],[.18,.24,.015]);
      for(const y of [1.2,1.82]) box(diagram,p.brass,[0,y,.102],[.9,.025,.015]);
      return end(g,'notice-board',1.4,.3,2.15,{face,diagram},[physical(1.4,.3,2.15)]);
    },
    valve() {
      const g=group('drain-valve');
      revolve(g,p.brass,[[0,0],[.19,0],[.19,.08],[.1,.12],[.1,.7],[.14,.74],[.14,.81],[0,.81]]);
      for(const y of [.13,.62]) cylinder(g,p.brass,[0,y,0],[.16,.08,.16]);
      beam(g,p.brass,[-.35,.16,0],[.35,.16,0],.085);
      const wheel=group('valve-wheel');wheel.position.set(0,.8,.19);g.add(wheel);
      ring(wheel,p.rust,[0,0,0],.26,.035);
      for(let i=0;i<4;i++) {const a=i*Math.PI/2;beam(wheel,p.rust,[0,0,0],[Math.cos(a)*.24,Math.sin(a)*.24,0],.024);}
      cylinder(wheel,p.brass,[0,0,0],[.06,.12,.06],[Math.PI/2,0,0]);
      return end(g,'valve',.75,.55,1.1,{wheel},[physical(.65,.5,1.1)]);
    },
    supplies() {
      const g=group('supplies-chest');box(g,p.green,[0,.4,0],[.85,.8,.7]);box(g,p.edge,[0,.85,0],[.93,.1,.77]);
      for(const y of [.25,.52]) {box(g,p.wood,[0,y,.36],[.72,.21,.035]);box(g,p.brass,[0,y,.39],[.18,.025,.04]);}
      corners(g,.86,.72,.075);corners(g,.93,.77,.84);
      const battery=builders.battery().group;battery.name='unique-battery';battery.position.y=.94;g.add(battery);
      return end(g,'supplies',.94,.78,1.2,{battery},[physical(.94,.78,.9)]);
    },
    battery() {
      const g=group('battery');box(g,p.dark,[0,0,0],[.5,.2,.3]);
      box(g,p.brass,[.18,.13,0],[.09,.06,.12]);box(g,p.rust,[-.18,.13,0],[.09,.06,.12]);
      box(g,p.paper,[0,.01,.158],[.18,.1,.014]);
      beam(g,p.green,[-.12,.15,-.04],[.12,.15,-.04],.018);
      return end(g,'battery',.51,.33,.27);
    },
    'archive-shelf'({width=.9,height=1.8,depth=.5}={}) {
      const g=group('archive-shelf');
      box(g,p.wood,[0,height/2,-depth/2+.035],[width,height,.07]);
      for(const x of [-width/2+.045,width/2-.045]) box(g,p.wood,[x,height/2,0],[.09,height,depth]);
      for(const y of [.08,height*.48,height-.08]) {
        box(g,p.wood,[0,y,0],[width,.08,depth+.04]);
        if(y>height*.8) continue;
        const count=Math.max(5,Math.floor((width-.14)/.12));
        for(let i=0;i<count;i++) {
          const x=-width/2+.14+i*(width-.25)/count,h=.45+(i%3)*.055;
          box(g,i%3===0?p.fold:p.green,[x,y+.04+h/2,.015],[.09,h,depth*.6]);
          box(g,p.paper,[x,y+.2+h*.35,depth*.3+.02],[.055,.075,.012]);
        }
      }
      for(const x of [-width/2+.06,width/2-.06]) box(g,p.brass,[x,.06,0],[.13,.09,depth+.03]);
      return end(g,'archive-shelf',width+.04,depth+.04,height,{},[physical(width,depth,height)]);
    },
    'stamp-set'() {
      const g=group('stamp-puzzle');box(g,p.edge,[0,0,0],[1.15,.06,.65]);
      for(let i=0;i<4;i++) {const x=(i%2)*.48-.24,z=Math.floor(i/2)*.28-.14;cylinder(g,p.rust,[x,.09,z],[.105,.12,.105]);revolve(g,p.wood,[[0,0],[.065,0],[.035,.06],[.055,.15],[0,.18]],[x,.15,z]);}
      return end(g,'stamp-set',1.15,.65,.36);
    },
    'key-bundle'() {
      const g=group('key-bundle');ring(g,p.brass,[-.12,.025,0],.08,.014,[Math.PI/2,0,0]);
      for(const z of [-.06,.06]) {box(g,p.brass,[.04,.025,z],[.25,.025,.035]);box(g,p.brass,[.14,.025,z+.035],[.045,.025,.1]);}
      return end(g,'key-bundle',.4,.25,.06);
    },
    'layered-label'() {
      const g=group('layered-label');box(g,p.paper,[0,0,0],[.85,.025,.55]);
      const flap=group('label-flap');flap.position.set(-.4,.025,0);g.add(flap);box(flap,p.green,[.4,0,0],[.8,.018,.5]);
      return end(g,'layered-label',.85,.55,.055,{flap});
    },
    'control-panel'() {
      const g=group('lifting-control');box(g,p.wood,[0,.45,0],[.8,.9,.56]);
      box(g,p.green,[0,1.02,0],[.94,.28,.7],[-.16,0,0]);
      for(const x of [-.22,.22]) {box(g,p.brass,[x,1.18,-.09],[.32,.035,.25]);box(g,p.dark,[x,1.203,-.09],[.27,.015,.2]);}
      for(let i=0;i<4;i++) cylinder(g,i===3?p.rust:p.brass,[-.3+i*.2,1.21,.18],[.045,.045,.045]);
      for(const y of [.25,.4,.55]) box(g,p.dark,[0,y,-.287],[.42,.035,.018]);
      const indicator=keep(sphere(g,signal,[.36,1.23,-.2],[.04,.025,.04]));indicator.name='crane-indicator';
      return end(g,'control-panel',.96,.72,1.28,{indicator},[physical(.95,.7,1.2)]);
    },
    'packing-table'() {
      const g=group('packing-table');table(g,2.05,.88,.78);box(g,p.paper,[0,.8,0],[1.85,.025,.7]);
      box(g,p.wood,[0,.18,0],[1.76,.06,.64]);
      return end(g,'packing-table',2.05,.88,.83,{},[physical(2.05,.88,.8)]);
    },
    'preservation-kit'() {
      const g=group('preservation-kit');box(g,p.green,[-.28,.15,0],[.9,.3,.58]);box(g,p.edge,[-.28,.32,0],[.94,.04,.62]);
      for(const x of [-.55,0]) box(g,p.brass,[x,.22,.3],[.07,.12,.035]);
      cylinder(g,p.paper,[.55,.09,0],[.09,.45,.09],[Math.PI/2,0,0]);
      box(g,p.wood,[.36,.04,.19],[.045,.05,.3]);box(g,p.brass,[.36,.04,-.03],[.07,.025,.14]);
      return end(g,'preservation-kit',1.5,.64,.36);
    },
    'exit-door'() {
      const g=group('exit-door');
      for(const x of [-.55,.55]) {box(g,p.wood,[x,1.15,0],[.13,2.3,.22]);box(g,p.edge,[x,.12,0],[.2,.24,.27]);}
      box(g,p.wood,[0,2.3,0],[1.25,.15,.24]);
      const door=group('door-leaf');door.position.set(-.5,0,0);door.rotation.y=-Math.PI/2;g.add(door);
      box(door,p.green,[.49,1.1,0],[.98,2.15,.09]);
      for(const side of [-1,1]) {box(door,p.wood,[.49,1.15,side*.056],[.72,1.7,.025]);box(door,p.brass,[.82,1.05,side*.085],[.14,.03,.04]);}
      return end(g,'exit-door',1.3,1.2,2.4,{},[physical(.2,.27,2.35,-.55),physical(.2,.27,2.35,.55),physical(.12,1.02,2.15,-.5,.49)]);
    },
    'office-desk'() {
      const g=group('office-desk');table(g,1.8,1,.94);
      for(const x of [-.54,.54]) {box(g,p.green,[x,.62,0],[.43,.47,.74]);for(const y of [.51,.71]) {box(g,p.wood,[x,y,.39],[.39,.17,.035]);box(g,p.brass,[x,y,.418],[.14,.025,.035]);}}
      box(g,p.green,[0,.956,0],[.7,.018,.62]);papers(g,.25,.98,-.1);
      return end(g,'office-desk',1.8,1,1.05,{},[physical(1.8,1,.95)]);
    },
    cupboard() {
      const g=group('office-cupboard');box(g,p.green,[0,1,0],[2.5,2,.5]);box(g,p.wood,[0,2.04,0],[2.6,.08,.57]);box(g,p.wood,[0,.08,0],[2.6,.12,.57]);
      for(const x of [-.62,.62]) {box(g,p.wood,[x,1,.263],[1.13,1.7,.035]);box(g,p.green,[x,1,.291],[.97,1.5,.022]);box(g,p.brass,[x+Math.sign(x)*-.4,1,.32],[.035,.22,.035]);}
      return end(g,'cupboard',2.6,.58,2.1,{},[physical(2.6,.58,2.1)]);
    },
    'reception-counter'() {
      const g=group('reception-counter');box(g,p.green,[0,.65,0],[4.5,1.3,.85]);box(g,p.paper,[0,1.34,0],[4.65,.09,.95]);box(g,p.wood,[0,.08,0],[4.6,.12,.9]);
      for(const x of [-1.55,0,1.55]) {box(g,p.wood,[x,.7,.438],[1.35,.95,.025]);box(g,p.green,[x,.7,.459],[1.18,.77,.018]);}
      return end(g,'reception-counter',4.65,.95,1.4,{},[physical(4.65,.95,1.4)]);
    },
    bench() {
      const g=group('foyer-bench');box(g,p.wood,[0,.45,0],[1.4,.15,2.5]);
      for(const x of [-.52,.52]) for(const z of [-1.02,1.02]) box(g,p.green,[x,.2,z],[.13,.4,.13]);
      for(const x of [-.39,0,.39]) box(g,p.fold,[x,.532,0],[.014,.012,2.3]);
      return end(g,'bench',1.4,2.5,.55,{},[physical(1.4,2.5,.55)]);
    },
    'map-lectern'({faceMaterial=p.paper}={}) {
      const g=group('map-lectern');box(g,p.wood,[0,.65,0],[1.8,1.3,.7]);box(g,p.green,[0,.69,.365],[1.5,1,.035]);box(g,p.brass,[0,1.34,0],[1.88,.06,.78]);
      box(g,p.wood,[0,1.43,.29],[1.74,.95,.14]);const face=keep(box(g,faceMaterial,[0,1.43,.37],[1.6,.85,.015]));
      return end(g,'map-lectern',1.9,.8,1.95,{face},[physical(1.9,.8,1.9)]);
    },
    clock() {
      const g=group('office-clock');cylinder(g,p.brass,[0,0,0],[.38,.08,.38],[Math.PI/2,0,0]);cylinder(g,p.paper,[0,0,.054],[.32,.025,.32],[Math.PI/2,0,0]);
      ring(g,p.wood,[0,0,.067],.325,.025);box(g,p.wood,[0,.1,.08],[.025,.21,.02]);box(g,p.wood,[.11,0,.08],[.23,.025,.02]);
      return end(g,'clock',.8,.15,.8);
    },
    'tools-rack'() {
      const g=group('maintenance-tools');box(g,p.green,[0,.32,0],[1.75,.8,.12]);
      for(const x of [-.55,0,.55]) {box(g,p.edge,[x,.25,.09],[.08,.55,.06]);ring(g,p.brass,[x,.57,.1],.13,.03);box(g,p.brass,[x,.03,.11],[.13,.1,.07]);}
      return end(g,'tools-rack',1.8,.24,.85);
    },
    'document-tray'() {
      const g=group('document-tray');box(g,p.wood,[0,.04,0],[.8,.08,.55]);
      for(const x of [-.38,.38]) box(g,p.wood,[x,.11,0],[.04,.14,.55]);box(g,p.wood,[0,.11,-.25],[.76,.14,.04]);papers(g,0,.095,0);
      return end(g,'document-tray',.8,.55,.2);
    },
    invitation({faceMaterial=p.paper}={}) {
      const g=group('invitation');box(g,p.paper,[0,0,0],[1.46,.72,.035]);const face=keep(box(g,faceMaterial,[0,0,.025],[1.4,.66,.012]));
      cylinder(g,p.rust,[.57,-.22,.045],[.07,.018,.07],[Math.PI/2,0,0]);
      return end(g,'invitation',1.46,.06,.72,{face});
    },
    'arch-window'({width=1.1,height=1.8}={}) {
      const g=group('arch-window');
      const arch=(w,h,bottom=0)=>{const s=new THREE.Shape();s.moveTo(-w/2,bottom);s.lineTo(w/2,bottom);s.lineTo(w/2,bottom+h-w/2);s.absarc(0,bottom+h-w/2,w/2,0,Math.PI,false);s.lineTo(-w/2,bottom);return s;};
      const frame=arch(width+.12,height+.06);const hole=arch(width-.1,height-.14,.08);frame.holes.push(hole);
      const frameGeo=geometry(new THREE.ExtrudeGeometry(frame,{depth:.1,bevelEnabled:false,curveSegments:12}));frameGeo.translate(0,0,-.05);mesh(g,frameGeo,p.brass);
      const glassGeo=geometry(new THREE.ExtrudeGeometry(arch(width-.1,height-.14,.08),{depth:.025,bevelEnabled:false,curveSegments:12}));glassGeo.translate(0,0,-.0125);mesh(g,glassGeo,glass);
      box(g,p.brass,[0,(height-width/2)/2,0],[.035,height-width/2,.08]);box(g,p.brass,[0,height*.48,0],[width,.035,.08]);box(g,p.edge,[0,0,0],[width+.2,.08,.22]);
      return end(g,'arch-window',width+.2,.23,height+.07);
    },
    'pipe-fixture'() {
      const g=group('brass-pipe');cylinder(g,p.brass,[0,1.3,0],[.08,2.6,.08]);
      for(const y of [.1,.8,1.9,2.5]) cylinder(g,p.brass,[0,y,0],[.13,.08,.13]);
      for(const y of [.55,2.1]) {box(g,p.wood,[0,y,-.09],[.25,.1,.15]);box(g,p.edge,[0,y,-.17],[.3,.18,.04]);}
      box(g,signal,[0,2.65,0],[.3,.06,.2]);
      return end(g,'pipe-fixture',.32,.4,2.7,{},[physical(.3,.35,2.6)]);
    },
  };
  function paper(blurred) { return blurred ? p.edge : p.paper; }
  return { ids: Object.freeze(Object.keys(builders)), create(id, options = {}) { if (!builders[id]) throw new Error(`Unknown museum prop ${id}`); return builders[id](options); } };
}
