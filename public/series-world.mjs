import { actionPlanFor, WALK_FORMATION, actorRouteFor } from './series-action-plan.mjs';
import { createMuseumProps } from './assets/episodes/ep-01/props.mjs';
import * as THREE from './vendor/three.module.js';
import { createAssetCore, MUSEUM_PALETTE } from './assets/shared/core.mjs';
import { createMuseumActors } from './assets/episodes/ep-01/actors.mjs';
import { createEpisode02Props } from './assets/episodes/ep-02/props.mjs';
import { createEpisode03Props } from './assets/episodes/ep-03/props.mjs';
import { createEpisode04Props } from './assets/episodes/ep-04/props.mjs';
import { createEpisode05Props } from './assets/episodes/ep-05/props.mjs';
import { createSeriesActors } from './assets/episodes/ep-02/actors.mjs';
import { collectStaticColliders } from './museum-colliders.mjs';

const TITLES = { 2: '종착역의 반대편', 3: '마지막 곡의 빈자리', 4: '수리하지 않는 것', 5: '지도 다음의 길' };
const LIMIT = { x: 12, z: 10 };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Standalone world; narrative state and saves belong to the caller. */
export function mountSeriesWorld(container, { onInteract = () => {}, onStep = () => {}, onSound = () => {}, onExit = () => {}, onFrame = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '방향키 또는 WASD로 이동, E로 조사, 드래그로 카메라 회전');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  const previousPosition = container.style.position;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.append(canvas);
  const caption = document.createElement('button');
  caption.type = 'button';
  caption.disabled = true;
  caption.style.cssText = 'position:absolute;left:50%;bottom:22px;transform:translateX(-50%);min-height:44px;max-width:calc(100% - 24px);padding:10px 18px;border:1px solid #b9c7b8;border-radius:8px;background:#183c35e8;color:#fff;font:15px system-ui;white-space:normal;touch-action:manipulation;cursor:pointer';
  caption.setAttribute('aria-live', 'polite');
  container.append(caption);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d5d8c7');
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 110);
  const focus = new THREE.Vector3(0, 0, 5);
  scene.add(new THREE.HemisphereLight('#ffefd5', '#658475', 2.7));
  const sun = new THREE.DirectionalLight('#fff2d3', 3.2);
  sun.position.set(-10, 22, 12); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: .1, far: 65 });
  sun.shadow.bias = -.0003; scene.add(sun);
  let world = null, player = null, moro = null, actors = [], hotspots = [], boxes = [], episodeId = null;
  let transition = null;
  let lastSound = null, soundCount = 0, ambientElapsed = 0, nextAmbientAt = 7;
  let story = null, plan = null, actionPlayback = null, core = null, catalog = null;
  let fieldObjects = new Map(), staticBoxes = [], storyActors = [], firstProjection = true;
  let targetMarker = null;
  let activeIds = null, labels = {};
  let locked = false, completed = new Set(), destination = null, disposed = false;
  let yaw = .55, pitch = .85, distance = 20, tick = 0, accumulator = 0, last = 0, footstep = 0, pointer = null;
  let geometries = new Set(), materials = new Set(), textures = new Set();
  const keys = new Set(), listeners = [];
  const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const rayPoint = new THREE.Vector3();
  const listen = (el, type, fn, options) => { el.addEventListener(type, fn, options); listeners.push(() => el.removeEventListener(type, fn, options)); };
  function clearWorld() {
    cancelAction();
    if (world) {
      world.traverse(o => { for (const texture of o.userData.assetTextures ?? []) textures.add(texture); });
      scene.remove(world);
    }
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    geometries = new Set(); materials = new Set(); textures = new Set();
    world = new THREE.Group(); scene.add(world); actors = []; hotspots = []; boxes = []; fieldObjects = new Map(); storyActors = []; plan = null; story = null; firstProjection = true; targetMarker = null;
  }
  function coreForWorld() {
    const material = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .86, ...extra }); materials.add(m); return m; };
    const paint = Object.fromEntries(Object.entries(MUSEUM_PALETTE).map(([id, color]) => [id, material(color)]));
    return createAssetCore(THREE, {
      geometry: g => (geometries.add(g), g), material, paint,
      glass: material('#8fac9f', { transparent: true, opacity: .25 }),
      signal: material('#dbda91', { emissive: '#c7bc62', emissiveIntensity: .5 }),
      waterPaint: material('#598f92', { roughness: .3 }), contact: material('#43564b', { transparent: true, opacity: .15 }),
    });
  }
  function placard(core, text, x, y, z, color = '#254d45') {
    const surface = document.createElement('canvas'); surface.width = 768; surface.height = 128;
    const ctx = surface.getContext('2d'); ctx.fillStyle = '#eee8d6'; ctx.fillRect(0, 0, 768, 128);
    ctx.fillStyle = color; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 384, 64, 726);
    const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const mat = core.material('#ffffff', { map: texture });
    core.box(world, core.paint.wood, [x, y, z], [4.7, .82, .12]);
    core.box(world, mat, [x, y, z + .072], [4.5, .75, .025]);
  }
  function environment(core, ep) {
    const { box, beam, cylinder, paint: p, material } = core;
    const floorPaint = ep === 3 ? p.wood : ep === 5 ? material('#a8b28a') : p.tile;
    box(world, floorPaint, [0, -.2, 0], [25, .4, 21]);
    for (let x = -12; x <= 12; x += 2) for (let z = -10; z <= 10; z += 2) {
      if (ep !== 5) box(world, p.edge, [x, .003, z], [1.96, .012, .025]);
    }
    // Cutaway walls keep the walking plane and actors readable at every orbit angle.
    for (const x of [-12.3, 12.3]) box(world, p.plaster, [x, .45, 0], [.35, .9, 20.8]);
    box(world, p.plaster, [0, .45, -10.3], [25, .9, .35]);
    for (const x of [-7, 7]) box(world, p.plaster, [x, .35, 10.3], [10, .7, .35]);
    if (ep === 2) {
      const rail = material('#68706b');
      for (const x of [-10.8, -9.8]) beam(world, rail, [x, .08, -10], [x, .08, 10], .085);
      for (let z = -9.8; z <= 10; z += .7) box(world, p.wood, [-10.3, .025, z], [2, .08, .2]);
      for (const x of [-6, 0, 6]) {
        cylinder(world, p.green, [x, 1.7, -8.6], [.12, 3.4, .12]);
        box(world, p.green, [x, 3.4, -8.6], [5.9, .15, 1.1]);
      }
      for (let i = 0; i < 3; i++) box(world, p.wood, [8, .4 + i * .55, -8], [2.3 - i * .2, .5, 1.2]);
      placard(core, '종착역 · 화물실', 0, 2.25, -8.6);
      for (let z = -9; z < 10; z++) box(world, p.brass, [-8.6, .012, z], [.22, .025, .6]);
    } else if (ep === 3) {
      const curtain = material('#854b42');
      box(world, p.wood, [0, .3, -8], [19, .6, 3.8]);
      for (const side of [-1, 1]) for (let i = 0; i < 8; i++) cylinder(world, curtain, [side * (8.3 + i * .2), 1.5, -9], [.15, 3, .15]);
      for (const x of [-8.5, 8.5]) for (const z of [-3, 0, 3]) {
        box(world, p.green, [x, .65, z], [1.2, .18, 1]);
        box(world, p.green, [x, 1.05, z + .48], [1.2, .9, .15]);
        for (const dx of [-.45, .45]) box(world, p.dark, [x + dx, .3, z], [.09, .6, .8]);
      }
      placard(core, '왕복길의 노래 · 리허설', 0, 2.3, -9.5);
    } else if (ep === 4) {
      for (const x of [-9, 9]) {
        box(world, p.wood, [x, 1, -6], [2.8, .2, 5]);
        for (const z of [-8, -4]) for (const dx of [-1.1, 1.1]) box(world, p.green, [x + dx, .5, z], [.15, 1, .15]);
      }
      for (let x = -7; x <= 7; x += 2) {
        core.ring(world, p.brass, [x, 1.45, -9.6], .3, .05);
        box(world, p.dark, [x, 1, -9.6], [.07, .8, .07]);
      }
      placard(core, '이전 준비 중 · 수리소', 0, 2.65, -9.6);
    } else {
      box(world, core.waterPaint, [-16, -.15, 0], [7, .13, 24]);
      for (let z = -10; z <= 10; z += 2) {
        cylinder(world, p.wood, [-11.7, .55, z], [.08, 1.1, .08]);
        if (z < 10) beam(world, p.wood, [-11.7, .9, z], [-11.7, .9, z + 2], .07);
      }
      box(world, material('#d8c8a6'), [0, .005, 0], [5, .02, 20]);
      for (const x of [-9, 9]) for (const z of [-8, 7]) {
        cylinder(world, p.wood, [x, 1.2, z], [.16, 2.4, .16]);
        core.sphere(world, p.green, [x, 2.8, z], [1.5, 1.5, 1.5]);
      }
      placard(core, '왕복길 · 출발과 돌아오는 곳', 0, 2, -9.5);
    }
    // Set dressing gets simple physical proxies; floors and overhead elements remain passable.
    if (ep === 2) {
      boxes.push({ minX: -12, maxX: -8.75, minZ: -10, maxZ: 10 });
      boxes.push({ minX: 6.8, maxX: 9.2, minZ: -8.7, maxZ: -7.3 });
    }
    if (ep === 3) {
      boxes.push({ minX: -9.5, maxX: 9.5, minZ: -10, maxZ: -6.1 });
      for (const x of [-8.5, 8.5]) for (const z of [-3, 0, 3])
        boxes.push({ minX: x - .6, maxX: x + .6, minZ: z - .5, maxZ: z + .56 });
    }
    if (ep === 4) for (const x of [-9, 9]) boxes.push({ minX: x - 1.4, maxX: x + 1.4, minZ: -8.5, maxZ: -3.5 });
    if (ep === 5) for (const x of [-9, 9]) for (const z of [-8, 7]) boxes.push({ minX: x - .16, maxX: x + .16, minZ: z - .16, maxZ: z + .16 });
  }
  function valid(x, z, radius = .38, ignore = null, from = null) {
    if (Math.abs(x) > LIMIT.x - radius || Math.abs(z) > LIMIT.z - radius) return false;
    for (const b of boxes) {
      const dx = Math.max(b.minX - x, 0, x - b.maxX), dz = Math.max(b.minZ - z, 0, z - b.maxZ);
      if (Math.hypot(dx, dz) < radius - 1e-8) return false;
    }
    for (const actor of actors) {
      if(actor===ignore || actor===moro || !actor.group.visible) continue;
      const p=actor.group.position,nextGap=Math.hypot(x-p.x,z-p.z);
      if(nextGap>=radius+.35)continue;
      // Recover an existing penetration only by moving farther out, never deeper in.
      const oldGap=from?Math.hypot(from.x-p.x,from.z-p.z):Infinity;
      if(!(oldGap<radius+.35 && nextGap>oldGap+1e-8))return false;
    }
    if (ignore && player && Math.hypot(x - player.group.position.x, z - player.group.position.z) < radius + .38) return false;
    return true;
  }
  function move(asset, dx, dz, radius, ignore) {
    const p = asset.group.position, beforeX = p.x, beforeZ = p.z;
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .045));
    for (let i = 0; i < count; i++) {
      const x = p.x + dx / count, z = p.z + dz / count;
      if (valid(x, z, radius, ignore, p)) p.set(x, 0, z);
      else { if (valid(x, p.z, radius, ignore, p)) p.x = x; if (valid(p.x, z, radius, ignore, p)) p.z = z; }
    }
    const moved = Math.hypot(p.x - beforeX, p.z - beforeZ);
    if (moved > .001) asset.group.rotation.y = Math.atan2(p.x - beforeX, p.z - beforeZ);
    (asset.parts.legs ?? []).forEach((leg, i) => { leg.rotation.x = moved > .001 ? Math.sin(tick * 10 + i * Math.PI) * .35 : 0; });
    return moved;
  }
  function nearest() {
    if (!player) return null;
    const p = player.group.position;
    return hotspots.filter(h => !activeIds || activeIds.has(h.id)).map(h => ({ ...h, label: labels[h.id] ?? h.label, distance: Math.hypot(p.x - h.x, p.z - h.z) }))
      .filter(h => h.distance <= 1.8).sort((a, b) => a.distance - b.distance)[0] ?? null;
  }
  function interact() {
    if (disposed || locked || actionPlayback) return;
    const target = nearest();
    if (target) { destination = null; keys.clear(); if (target.id === '__exit') onExit(); else onInteract(target.id); }
  }
  function setEpisode({ episodeId: id, hotspots: entries = [], moroAccompanies = false, createProps = null }) {
    if (![2, 3, 4, 5].includes(Number(id))) throw new Error('Unknown series episode');
    clearWorld(); lastSound=null; ambientElapsed=0; nextAmbientAt=7; episodeId = Number(id); destination = null; completed.clear(); keys.clear(); activeIds = null; labels = {}; tick = 0;
    core = coreForWorld(); const actorKit = createMuseumActors(core), seriesActors = createSeriesActors(core);
    environment(core, episodeId);
    const factories = { 1: createMuseumProps, 2: createEpisode02Props, 3: createEpisode03Props, 4: createEpisode04Props, 5: createEpisode05Props };
    const catalogs = new Map([[episodeId, (createProps ?? factories[episodeId])(core)]]);
    catalog = id => { if (!catalogs.has(id)) catalogs.set(id, factories[id](core)); return catalogs.get(id); };
    entries.forEach((entry, index) => {
      const x = episodeId === 5 && entry.id === 'consult' ? 7 : entry.x ?? (index % 2 ? 5 : -5), z = episodeId === 5 && entry.id === 'consult' ? 4 : entry.z ?? (-5 + Math.floor(index / 2) * 5);
      const h = { ...entry, x, z }; hotspots.push(h);
      if (entry.kind === 'npc') {
        const actorId = entry.assetId ?? ({ 2: 'munjeong', 3: 'sohui', 4: 'taeo', 5: 'narae' }[episodeId]);
        const asset = seriesActors.create(actorId); asset.group.position.set(x, 0, z); asset.actorId = actorId; asset.home = [x, z]; asset.phase = index; asset.hotspot = h;
        world.add(asset.group); actors.push(asset);
      } else if (entry.assetId) {
        const asset = catalog(entry.assetEpisode ?? episodeId).create(entry.assetId);
        let supportY = 0;
        if (asset.pivot === 'support-center') {
          const width = Math.max(1.4, asset.footprint[0] + .25), depth = Math.max(.85, asset.footprint[1] + .25);
          core.box(world, core.paint.wood, [x, .83, z], [width, .14, depth]);
          for (const dx of [-width / 2 + .1, width / 2 - .1])
            for (const dz of [-depth / 2 + .1, depth / 2 - .1])
              core.box(world, core.paint.green, [x + dx, .4, z + dz], [.09, .8, .09]);
          const bounds = new THREE.Box3().setFromObject(asset.group);
          supportY = .905 - bounds.min.y;
          boxes.push({ minX:x-width/2, maxX:x+width/2, minZ:z-depth/2, maxZ:z+depth/2 });
        }
        asset.group.position.set(x, supportY, z); world.add(asset.group);
        boxes.push(...collectStaticColliders(asset.group));
      } else {
        // A physical reading desk for manuscript evidence without a separate model.
        core.box(world, core.paint.wood, [x, .82, z], [1.2, .12, .7]);
        for (const dx of [-.48, .48]) core.box(world, core.paint.green, [x + dx, .4, z], [.08, .8, .6]);
        core.box(world, core.paint.paper, [x, .9, z], [.6, .035, .4]);
        boxes.push({ minX: x - .6, maxX: x + .6, minZ: z - .35, maxZ: z + .35 });
      }
      placard(core, entry.label, x, 1.8, z - .18);
    });
    hotspots.push({ id: '__exit', label: '다음 장소로 출발', x: 0, z: 9 });
    core.box(world, core.paint.brass, [0, .02, 9.2], [2, .04, .45]);
    player = actorKit.create('player'); player.group.position.set(0, 0, 6); world.add(player.group);
    moro = moroAccompanies ? actorKit.create('moro') : null;
    if (moro) { moro.group.position.set(1.2, 0, 7.2); moro.home = [1.2, 7.2]; moro.phase = 0; actors.push(moro); world.add(moro.group); }
    staticBoxes = [...boxes];
    if (episodeId === 5) {
      for (const [id,x,z] of [['neighbor',WALK_FORMATION.neighbor,6],['munjeong',WALK_FORMATION.munjeong,6],['sohui',5,1],['taeo',-6,-3],['ideun',-7,-3],['jeongyeon',-2,-5]]) {
        const asset=seriesActors.create(id); asset.actorId=id; asset.home=[x,z]; asset.phase=0; asset.storyActor=true;
        asset.group.position.set(x,0,z); world.add(asset.group); actors.push(asset); storyActors.push(asset);
      }
    }
    targetMarker=core.ring(world,core.paint.brass,[0,.04,0],.65,.035,[-Math.PI/2,0,0]);
    targetMarker.userData.keepMesh=true;targetMarker.visible=false;
    core.finish(world, `episode-${episodeId}-world`, { colliders: [] });
    world.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    focus.set(0, .6, 4); scene.background.set(episodeId === 3 ? '#bcb5aa' : episodeId === 5 ? '#c9d8bf' : '#d5d8c7');
    resize(); updateCamera(1); renderer.render(scene, camera);
  }
  function resetPose(asset) {
    asset.group.rotation.set(0,0,0); asset.group.scale.set(1,1,1);
    for (const [part,pose] of asset.restParts ?? []) {part.position.copy(pose.position);part.rotation.copy(pose.rotation);}
  }
  function applyPose(asset,pose) {
    asset.group.position.set(pose.x,pose.y,pose.z);asset.group.rotation.y=pose.rotation;asset.group.visible=pose.visible;
    if(pose.part && asset.parts[pose.part]) asset.parts[pose.part].rotation[pose.axis]=pose.angle;
    if(pose.deployed) for(const leg of asset.parts.legs??[]) leg.rotation.z=0;
    if(pose.cardRaised && asset.parts.cards) {const card=asset.parts.cards.at(-1);card.position.y=.75;card.rotation.x=Math.PI/2;}
  }
  function projectActor(actor,pose) {
    const key=`${pose.x},${pose.z}`;
    if(!firstProjection && actor.projectedPose===key)return;
    // A canonical destination can be occupied by the player after free exploration.
    // Keep physical separation; defer relocation if no nearby standing spot is free.
    const offsets=[[0,0],[0,.8],[.8,0],[0,-.8],[-.8,0],[0,1.2],[1.2,0],[0,-1.2],[-1.2,0]];
    const spot=offsets.map(([x,z])=>({x:pose.x+x,z:pose.z+z})).find(p=>valid(p.x,p.z,.35,actor));
    if(!spot)return;
    actor.group.position.set(spot.x,0,spot.z);actor.projectedPose=key;
  }
  function applyStory(state) {
    if(!world || state.episodeId!==episodeId) return;
    story=state; plan=actionPlanFor(state);
    if(actionPlayback) return;
    for(const definition of plan.objects) {
      if(!fieldObjects.has(definition.id)) {
        const asset=catalog(definition.assetEpisode).create(definition.assetId);
        asset.restParts=[];asset.group.traverse(part=>asset.restParts.push([part,{position:part.position.clone(),rotation:part.rotation.clone()}]));
        world.add(asset.group);fieldObjects.set(definition.id,asset);
        if(definition.y>.8) {
          core.box(world,core.paint.wood,[definition.x,.82,definition.z],[1.5,.12,.9]);
          for(const dx of [-.6,.6]) core.box(world,core.paint.green,[definition.x+dx,.4,definition.z],[.09,.8,.75]);
          staticBoxes.push({minX:definition.x-.75,maxX:definition.x+.75,minZ:definition.z-.45,maxZ:definition.z+.45});
        }
      }
      const asset=fieldObjects.get(definition.id);resetPose(asset);applyPose(asset,plan.projection[definition.id]);
    }
    boxes=[...staticBoxes];
    for(const asset of fieldObjects.values()) if(asset.group.visible) boxes.push(...collectStaticColliders(asset.group));
    hotspots=hotspots.filter(h=>!h.action).concat(plan.hotspots.map(h=>({...h,action:true})));
    targetMarker.visible=Boolean(plan.nextAction);
    if(plan.nextAction) targetMarker.position.set(plan.nextAction.x,.04,plan.nextAction.z);
    // Participants are derived from the saved decisions, not inferred from a performed demonstration.
    for(const actor of actors) {
      for(const arm of actor.parts.arms??[]) arm.rotation.set(0,0,0);
      if(actor.actorId==='jeongyeon' && episodeId===3) projectActor(actor,plan.participants.jungyeon?{x:actor.home[0],z:actor.home[1]}:{x:6,z:5});
      if(episodeId===5 && actor.actorId==='jeongyeon') actor.group.visible=plan.participants.jungyeon;
      if(episodeId===5 && actor.actorId==='ideun') actor.group.visible=plan.participants.handover;
      if(episodeId===5 && actor.actorId==='taeo') actor.group.visible=!plan.participants.handover;
    }
    const lastWalk=[...plan.completed].reverse().map(id=>plan.actions.find(a=>a.id===id)).find(a=>a?.path);
    if(firstProjection && lastWalk) {const [x,z]=lastWalk.path.at(-1);player.group.position.set(x,0,z);}
    for(const actor of storyActors) {
      const pose=plan.npcProjection[actor.actorId];
      if(pose) projectActor(actor,pose);
    }
    for(const actor of actors) if(actor.hotspot) {actor.hotspot.x=actor.group.position.x;actor.hotspot.z=actor.group.position.z;}
    firstProjection=false;
  }
  function emitSound(kind,x,z) {
    if(!player || document.hidden || disposed || (locked && !actionPlayback))return;
    const dx=x-player.group.position.x,dz=z-player.group.position.z;
    const distance=Math.hypot(dx,dz);
    const pan=clamp((dx*Math.cos(yaw)-dz*Math.sin(yaw))/Math.max(3,distance),-1,1);
    lastSound={kind,distance,pan,source:{x,z},episodeId};soundCount++;
    onSound(kind,{distance,pan});
  }
  function routeMetrics(points) {
    const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
    return {points,lengths,length:lengths.reduce((a,b)=>a+b,0)};
  }
  function routePosition(route,t) {
    if(route.points.length===1)return {x:route.points[0][0],z:route.points[0][1],yaw:0};
    let travelled=t*route.length,index=0;
    while(index<route.lengths.length-1 && travelled>route.lengths[index]) travelled-=route.lengths[index++];
    const a=route.points[index],b=route.points[index+1],fraction=route.lengths[index]?travelled/route.lengths[index]:1;
    return {x:THREE.MathUtils.lerp(a[0],b[0],fraction),z:THREE.MathUtils.lerp(a[1],b[1],fraction),yaw:Math.atan2(b[0]-a[0],b[1]-a[1])};
  }
  function playAction(id,{onComplete=()=>{}}={}) {
    if(actionPlayback || !plan || plan.nextAction?.id!==id) return false;
    const action=plan.nextAction;
    if(Math.hypot(player.group.position.x-action.x,player.group.position.z-action.z)>1.8) return false;
    const projected=actionPlanFor({...story,episodes:{...story.episodes,[episodeId]:{...story.episodes[episodeId],completedActions:[...plan.completed,id]}}});
    const route=action.path ? [[player.group.position.x,player.group.position.z],...action.path] : null;
    const lengths=route?.slice(1).map((p,i)=>Math.hypot(p[0]-route[i][0],p[1]-route[i][1]))??[];
    const length=lengths.reduce((a,b)=>a+b,0);
    const actorRoutes=new Map();
    for(const actor of storyActors) {
      const p=actor.group.position,points=actorRouteFor(action,actor.actorId,[p.x,p.z]);
      if(points)actorRoutes.set(actor,routeMetrics(points));
    }
    let walkApproach=null,walkRoute=null,approachDuration=0;
    if(action.path) {
      const start=[player.group.position.x,player.group.position.z],goal=action.path[0];
      const candidates=[[start,goal],[start,[start[0],goal[1]+1],[goal[0],goal[1]+1],goal]];
      const approach=candidates.find(points=>points.slice(1).every((b,i)=>{
        const a=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.04));
        for(let j=1;j<=steps;j++)if(!valid(THREE.MathUtils.lerp(a[0],b[0],j/steps),THREE.MathUtils.lerp(a[1],b[1],j/steps)))return false;
        return true;
      }));
      if(!approach)return false;
      walkApproach={player:routeMetrics(approach),actors:new Map()};
      for(const [actor,route] of actorRoutes) walkApproach.actors.set(actor,routeMetrics(route.points.slice(0,route.points.length-action.path.length+1)));
      approachDuration=Math.max(walkApproach.player.length,...[...walkApproach.actors.values()].map(r=>r.length))/2.5;
      walkRoute=routeMetrics(action.path);
    }
    const actorTravel=Math.max(0,...[...actorRoutes.values()].map(r=>r.length))/2.5;
    actionPlayback={action,onComplete,elapsed:0,duration:walkRoute?approachDuration+walkRoute.length/2.5:Math.max(2.1,actorTravel),route,lengths,length,actorRoutes,walkApproach,walkRoute,approachDuration,
      before:structuredClone(plan.projection),after:projected.projection,playerStart:player.group.position.clone(),
      actorStarts:actors.map(a=>[a,a.group.position.clone()]),emittedBeats:0,stepCount:0};
    if(['fold','write'].includes(action.motion))emitSound('paper',action.x,action.z);
    else if(['assemble','turn'].includes(action.motion))emitSound(episodeId===4?'metal':'wood',action.x,action.z);
    destination=null;keys.clear();return true;
  }
  function cancelAction() {
    const running=actionPlayback;actionPlayback=null;
    if(running && player) {
      player.group.position.copy(running.playerStart);
      for(const [actor,pos] of running.actorStarts) actor.group.position.copy(pos);
      for(const actor of [player,...actors]) for(const part of [...actor.parts.legs??[],...actor.parts.arms??[]]) part.rotation.set(0,0,0);
    }
    if(story && world && !disposed) applyStory(story);
  }
  function animateAction(dt) {
    const running=actionPlayback;if(!running)return;
    running.elapsed=Math.min(running.duration,running.elapsed+dt);
    const t=running.elapsed/running.duration, ease=t*t*(3-2*t), action=running.action;
    if(action.motion==='beats') {
      const reached=Math.min(4,Math.floor(t*4)+1);
      while(running.emittedBeats<reached) {emitSound('beat',action.x,action.z);running.emittedBeats++;}
    }
    if(running.walkRoute && Math.floor(running.elapsed/.45)>running.stepCount) {
      running.stepCount=Math.floor(running.elapsed/.45);emitSound('step',player.group.position.x,player.group.position.z);
    }
    for(const [id,asset] of fieldObjects) {
      const from=running.before[id],to=running.after[id];
      asset.group.visible=from.visible||to.visible;
      asset.group.position.set(THREE.MathUtils.lerp(from.x,to.x,ease),THREE.MathUtils.lerp(from.y,to.y,ease),THREE.MathUtils.lerp(from.z,to.z,ease));
      asset.group.rotation.y=THREE.MathUtils.lerp(from.rotation,to.rotation,ease);
      if(to.part && asset.parts[to.part]) asset.parts[to.part].rotation[to.axis]=THREE.MathUtils.lerp(from.angle??0,to.angle,ease);
      if(to.deployed) for(const leg of asset.parts.legs??[]) leg.rotation.z=(1-ease)*Math.PI*.38;
      if(to.cardRaised && asset.parts.cards) {const card=asset.parts.cards.at(-1);card.position.y=.75*ease;card.rotation.x=Math.PI/2*ease;}
      if(!from.visible && to.visible) asset.group.position.y+=Math.sin(Math.PI*t)*.4;
    }
    if(running.walkRoute) {
      const approaching=running.elapsed<running.approachDuration;
      const progress=approaching?running.elapsed/running.approachDuration:(running.elapsed-running.approachDuration)/(running.duration-running.approachDuration);
      const pose=routePosition(approaching?running.walkApproach.player:running.walkRoute,progress);
      player.group.position.set(pose.x,0,pose.z);player.group.rotation.y=pose.yaw;
      for(const [i,leg] of (player.parts.legs??[]).entries()) leg.rotation.x=Math.sin(running.elapsed*10+i*Math.PI)*.35;
      for(const [actor,approach] of running.walkApproach.actors) {
        const actorPose=approaching?routePosition(approach,progress):{...pose,x:pose.x+WALK_FORMATION[actor.actorId]};
        actor.group.position.set(actorPose.x,0,actorPose.z);actor.group.rotation.y=actorPose.yaw;
        for(const [i,leg] of (actor.parts.legs??[]).entries()) leg.rotation.x=Math.sin(running.elapsed*10+i*Math.PI)*.3;
      }
    } else {
      const participants=actors.filter(a=>a!==moro && a.group.visible && (a.actorId!=='jeongyeon'||plan.participants.jungyeon||action.motion==='listen'));
      for(const actor of participants) {
        const p=actor.group.position;
        if(Math.hypot(p.x-action.x,p.z-action.z)>7) continue;
        actor.group.rotation.y=Math.atan2(player.group.position.x-p.x,player.group.position.z-p.z);
        const envelope=Math.sin(Math.PI*t),beat=action.motion==='beats'?Math.abs(Math.sin(t*Math.PI*4)):1;
        for(const [i,arm] of (actor.parts.arms??[]).entries()) arm.rotation.z=(i?1:-1)*envelope*beat*(action.motion==='signal'?2:action.motion==='greet'?1.4:.65);
      }
    }
    for(const [actor,route] of running.walkRoute?[]:running.actorRoutes) {
      const pose=routePosition(route,t);actor.group.position.set(pose.x,0,pose.z);actor.group.rotation.y=pose.yaw;
      for(const [i,leg] of (actor.parts.legs??[]).entries()) leg.rotation.x=route.length>.01?Math.sin(running.elapsed*10+i*Math.PI)*.3:0;
    }
    if(t===1) {
      const done=running.onComplete; actionPlayback=null;
      for(const actor of [player,...actors]) for(const part of [...actor.parts.legs??[],...actor.parts.arms??[]]) part.rotation.set(0,0,0);
      for(const [id,asset] of fieldObjects) {resetPose(asset);applyPose(asset,running.after[id]);}
      done();
    }
  }
  function updateCamera(dt) {
    if (player) {
      const p = player.group.position;
      focus.lerp(new THREE.Vector3(clamp(p.x * .55, -5, 5), .5, clamp(p.z * .55, -4, 4)), 1 - Math.exp(-4 * dt));
    }
    camera.position.set(focus.x + Math.sin(yaw) * Math.cos(pitch) * distance, focus.y + Math.sin(pitch) * distance, focus.z + Math.cos(yaw) * Math.cos(pitch) * distance);
    if (transition) {
      const progress = clamp(transition.progress ?? 0, 0, 1);
      const amount = Math.sin(progress * Math.PI);
      if (transition.style === 'curtain') camera.position.y += amount * 3;
      else if (transition.style === 'door') camera.position.lerp(new THREE.Vector3(0, 3, 12), amount * .7);
      else if (transition.style === 'dawn') { camera.position.y += amount * 7; sun.intensity = 3.2 + amount * 1.2; }
      else camera.position.x += amount * 5;
    } else sun.intensity = 3.2;
    camera.lookAt(focus);
  }
  function simulate(dt) {
    if (!player || locked || actionPlayback) return;
    tick += dt;
    if(episodeId===5 && !document.hidden) {
      ambientElapsed+=dt;
      if(ambientElapsed>=nextAmbientAt) {
        const bird=Math.floor(nextAmbientAt/7)%2===1;
        emitSound(bird?'bird':'water',bird?-9:-12,bird?7:-2);
        nextAmbientAt+=7;
      }
    }
    let sx = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    let sz = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    let dx = sx * Math.cos(yaw) + sz * Math.sin(yaw), dz = -sx * Math.sin(yaw) + sz * Math.cos(yaw);
    if (sx || sz) destination = null;
    else if (destination) { dx = destination.x - player.group.position.x; dz = destination.z - player.group.position.z; if (Math.hypot(dx, dz) < .12) { destination = null; dx = dz = 0; } }
    const length = Math.hypot(dx, dz);
    if (length) {
      const step = Math.min(length, 3.6 * dt), moved = move(player, dx / length * step, dz / length * step, .38, null);
      footstep += moved; if (footstep > .9) { onStep(); footstep = 0; }
      if (destination && moved < .001) destination = null;
    } else (player.parts.legs ?? []).forEach(leg => { leg.rotation.x = 0; });
    for (const actor of actors) {
      const p = actor.group.position, distanceToPlayer = p.distanceTo(player.group.position);
      if (actor === moro) {
        if (distanceToPlayer > 1.8) {
          const v = player.group.position.clone().sub(p).normalize().multiplyScalar(2.8 * dt); move(actor, v.x, v.z, .35, actor);
        }
      } else if (actor.storyActor || distanceToPlayer < 3) {
        actor.group.rotation.y = Math.atan2(player.group.position.x - p.x, player.group.position.z - p.z);
        (actor.parts.legs ?? []).forEach(leg => { leg.rotation.x = 0; });
      } else {
        const targetX = actor.home[0] + Math.sin(tick * .3 + actor.phase) * .5;
        move(actor, clamp(targetX - p.x, -.35 * dt, .35 * dt), 0, .35, actor);
      }
      if (actor.hotspot) { actor.hotspot.x = p.x; actor.hotspot.z = p.z; }
      if (actor.parts.head) actor.parts.head.rotation.x = Math.sin(tick * 1.4 + actor.phase) * .035;
    }
  }
  function frame(time) {
    if (disposed) return;
    const dt = Math.min((time - last) / 1000 || 0, .1); last = time; onFrame(dt); accumulator += dt;
    while (accumulator >= 1 / 60) { simulate(1 / 60); accumulator -= 1 / 60; }
    animateAction(dt);
    updateCamera(dt);
    const target = nearest();
    const message = actionPlayback ? actionPlayback.action.label : locked ? '이야기 진행 중' : target ? `클릭 / E · ${target.label}${completed.has(target.id) ? ' · 확인함' : ''}` : '바닥 클릭으로 이동 · 가까이서 버튼 / E · 드래그 시점';
    if (caption.textContent !== message) caption.textContent = message;
    caption.disabled = locked || Boolean(actionPlayback) || !target;
    caption.style.cursor = caption.disabled ? 'default' : 'pointer';
    renderer.render(scene, camera);
  }
  function resize() { const r = container.getBoundingClientRect(); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = Math.max(1, r.width) / Math.max(1, r.height); camera.updateProjectionMatrix(); }
  const observer = new ResizeObserver(resize); observer.observe(container);
  listen(canvas, 'keydown', event => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE'].includes(event.code)) {
      event.preventDefault(); if (!locked) { keys.add(event.code); if (event.code === 'KeyE' && !event.repeat) interact(); }
    }
  });
  function resetPointer() {
    const id = pointer?.id; pointer = null;
    if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  listen(caption, 'click', interact);
  listen(canvas, 'keyup', e => keys.delete(e.code));
  listen(canvas, 'blur', () => { keys.clear(); resetPointer(); });
  listen(window, 'blur', () => { keys.clear(); destination = null; resetPointer(); });
  listen(canvas, 'pointerdown', e => { if (locked || actionPlayback || !e.isPrimary || e.button !== 0) return; canvas.focus(); canvas.setPointerCapture(e.pointerId); pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false }; });
  listen(canvas, 'pointermove', e => {
    if (!pointer || pointer.id !== e.pointerId || locked) return;
    if (Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 6) pointer.moved = true;
    if (pointer.moved) { yaw -= (e.clientX - pointer.lastX) * .006; pitch = clamp(pitch + (e.clientY - pointer.lastY) * .004, .65, 1.35); }
    pointer.lastX = e.clientX; pointer.lastY = e.clientY;
  });
  listen(canvas, 'pointerup', e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    const clicked = !pointer.moved; resetPointer();
    if (!clicked || locked) return;
    const rect = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
    if (ray.ray.intersectPlane(groundPlane, rayPoint) && valid(rayPoint.x, rayPoint.z)) destination = { x: rayPoint.x, z: rayPoint.z };
  });
  listen(canvas, 'pointercancel', resetPointer);
  listen(canvas, 'lostpointercapture', resetPointer);
  listen(canvas, 'wheel', e => { e.preventDefault(); distance = clamp(distance + e.deltaY * .015, 12, 32); }, { passive: false });
  renderer.setAnimationLoop(frame);
  return {
    setEpisode, applyStory, playAction, cancelAction,
    setTransition(frame) { transition = frame; },
    update({ locked: nextLocked = locked, completedIds = [...completed], activeIds: nextActive = activeIds, labels: nextLabels = labels } = {}) {
      locked = nextLocked; completed = new Set(completedIds);
      activeIds = nextActive == null ? null : new Set(nextActive); labels = { ...nextLabels };
      if (locked) { destination = null; keys.clear(); resetPointer(); caption.disabled = true; }
    },
    diagnostics() { return { episodeId, lastSound, soundCount, activeIds:activeIds?[...activeIds]:null, nextAction:plan?.nextAction??null, action: actionPlayback?.action.id ?? null, actionProgress: actionPlayback ? actionPlayback.elapsed / actionPlayback.duration : null, projection: plan?.projection ?? null, participants: plan?.participants ?? null, objects: [...fieldObjects].map(([id,a])=>({id,visible:a.group.visible,x:a.group.position.x,y:a.group.position.y,z:a.group.position.z})), actors: actors.map(a=>({id:a.actorId??'moro',x:a.group.position.x,z:a.group.position.z})), player: player ? { x: player.group.position.x, z: player.group.position.z } : null, locked, nearest: nearest()?.id ?? null, hotspots: hotspots.map(({ id, x, z }) => ({ id, x, z })), boxes, camera: { yaw, pitch, distance }, renderer: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }, title: TITLES[episodeId] }; },
    dispose() { if (disposed) return; disposed = true; renderer.setAnimationLoop(null); observer.disconnect(); listeners.forEach(remove => remove()); clearWorld(); renderer.dispose(); canvas.remove(); caption.remove(); container.style.position = previousPosition; },
  };
}
