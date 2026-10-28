import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startMuseumGame } from './browser-game-entry.mjs';

// This run starts at the invitation. Its only writes are real UI input and normal game saves.
const base = process.argv[2] ?? 'http://127.0.0.1:5188';
const output = resolve(process.argv[3] ?? 'artifacts/series-full-play');
const load = createRequire(process.argv[4] ? resolve(process.argv[4], 'package.json') : import.meta.url);
const { chromium } = load('playwright');
const browser = await chromium.launchPersistentContext(resolve(output,'browser-profile'),{headless:true,viewport:{width:1440,height:1000},reducedMotion:'no-preference',recordVideo:{dir:resolve(output,'motion'),size:{width:960,height:666}}});
const page = browser.pages()[0] ?? await browser.newPage();
const errors = [], samples = [];
const buildHash=createHash('sha256').update(await readFile(new URL('../dist/app.mjs',import.meta.url))).update(await readFile(new URL('../dist/museum-scene.mjs',import.meta.url))).update(await readFile(new URL('../dist/series-game.mjs',import.meta.url))).digest('hex');
page.on('pageerror', e=>errors.push(e.message));
await mkdir(output,{recursive:true});
const museum = ()=>page.evaluate(()=>({view:window.qaView,world:window.museumDiagnostics()}));
async function sample(stage) {
  const data = await page.evaluate(()=>({view:window.qaView,museum:window.museumDiagnostics(),series:window.seriesDiagnostics?.()}));
  samples.push({stage,...data});
  process.stdout.write(`${stage}: ${data.series?.view?.episodeId ?? data.view.sceneId}/${data.series?.view?.stage ?? data.view.phase}\n`);
  await writeFile(resolve(output,'progress.json'),JSON.stringify({buildHash,samples,errors},null,2));
}
async function checkpoint(action) {
  const data=await page.evaluate(()=>({view:window.qaView,storage:Object.fromEntries(Object.entries(localStorage)),series:window.seriesDiagnostics?.()}));
  await writeFile(resolve(output,'checkpoint.json'),JSON.stringify({buildHash,action,at:new Date().toISOString(),...data},null,2));
}
async function floorClick(x,z) {
  await checkpoint(`floor:${x},${z}`);
  const screen = await page.evaluate(async ({x,z})=>{
    const T=await import('./vendor/three.module.js'),d=window.museumDiagnostics(),hh=(d.cameraFrustum.top-d.cameraFrustum.bottom)/2;
    const c=new T.OrthographicCamera(-hh*d.width/d.height,hh*d.width/d.height,d.cameraFrustum.top,d.cameraFrustum.bottom,.1,100);
    c.position.fromArray(d.cameraPosition);c.zoom=d.cameraZoom;c.lookAt(new T.Vector3(...d.cameraTarget));c.updateProjectionMatrix();c.updateMatrixWorld(true);
    const p=new T.Vector3(x,.04,z).project(c),canvas=document.querySelector('#museum-stage canvas'),r=canvas.getBoundingClientRect();
    const sx=r.x+(p.x+1)*d.width/2,sy=r.y+(1-p.y)*d.height/2;
    return {x:sx,y:sy,clear:document.elementFromPoint(sx,sy)===canvas};
  },{x,z});
  if(!screen.clear)return false;
  await page.mouse.click(screen.x,screen.y);await page.waitForTimeout(200);
  await page.waitForFunction(()=>window.museumDiagnostics().avatar.waypoints===0,null,{timeout:20000});
  await page.waitForTimeout(100);return true;
}
async function walk(x,z) {
  for(let i=0;i<5;i++) {
    const {world:d}=await museum(),a=d.avatar,dist=Math.hypot(x-a.x,z-a.z);
    if(dist<.2)return true;
    const ux=(x-a.x)/dist,uz=(z-a.z)/dist,step=Math.min(3,dist);
    const candidates=[[x,z],[a.x+ux*step,a.z+uz*step],
      [a.x+ux*step-uz*1.6,a.z+uz*step+ux*1.6],[a.x+ux*step+uz*1.6,a.z+uz*step-ux*1.6]];
    let moved=false;
    for(const [tx,tz] of candidates) {
      const clicked=await floorClick(tx,tz),after=(await museum()).world.avatar;
      if(clicked && Math.hypot(after.x-a.x,after.z-a.z)>.1){moved=true;break;}
    }
    if(!moved){process.stdout.write(`WALK blocked ${JSON.stringify({from:a,target:[x,z]})}\n`);return false;}
  }
  return false;
}
async function approach(id) {
  await checkpoint(`interact:${id}`);
  const initial=(await museum()).world,initialTarget=initial.interactionTargets?.find(h=>h.id===id);
  const facing=initialTarget.anchor==='boat'?0:Math.atan2(initial.avatar.z-initialTarget.z,initial.avatar.x-initialTarget.x);
  for(let attempt=0;attempt<16;attempt++) {
    const d=(await museum()).world;
    if(d.hotspots.some(h=>h.id===id&&h.visible)) {
      await page.locator('#museum-stage canvas').focus();await page.keyboard.press('e');
      await page.waitForTimeout(160);return;
    }
    const other=d.hotspots.find(h=>h.visible && h.id!==id && h.id!=='field-action' && d.interactionTargets?.some(t=>t.id===h.id&&!t.visited));
    if(other && id!=='field-action') {
      await page.locator('#museum-stage canvas').focus();await page.keyboard.press('e');await page.waitForTimeout(160);
      await page.evaluate(()=>window.investigationQA.read());await page.evaluate(()=>window.investigationQA.field());continue;
    }
    const target=d.interactionTargets?.find(h=>h.id===id);
    assert.ok(target && Number.isFinite(target.x),`World target ${id} exists in ${d.sceneId}`);
    if(Math.hypot(target.x-d.avatar.x,target.z-d.avatar.z)<2.4) {
      const dx=target.x-d.avatar.x,dz=target.z-d.avatar.z,yaw=Math.atan2(d.cameraPosition[0]-d.cameraTarget[0],d.cameraPosition[2]-d.cameraTarget[2]);
      const sx=dx*Math.cos(yaw)-dz*Math.sin(yaw),sz=dx*Math.sin(yaw)+dz*Math.cos(yaw),keys=[];
      const threshold=Math.max(Math.abs(sx),Math.abs(sz))*.4;
      if(Math.abs(sx)>threshold)keys.push(sx>0?'d':'a');if(Math.abs(sz)>threshold)keys.push(sz>0?'s':'w');
      await page.locator('#museum-stage canvas').focus();for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(90);for(const k of keys)await page.keyboard.up(k);
      if((await museum()).world.hotspots.some(h=>h.id===id&&h.visible))continue;
    }
    const angle=attempt===0?facing:(attempt-1)*Math.PI/6;
    const radius=target.anchor==='boat'?1.94:1.85;
    await walk(target.x+Math.cos(angle)*radius,target.z+Math.sin(angle)*radius);
  }
  throw Error(`Could not reach ${id}: ${JSON.stringify(await museum())}`);
}
async function travel() {
  const route=await page.evaluate(async()=>{
    const {roomRoute,ROOMS}=await import('./museum-map.mjs');
    const v=window.qaView;return roomRoute(v.currentRoomId,v.travel.toRoomId).map(id=>ROOMS.find(r=>r.id===id));
  });
  for(let i=0;i<route.length-1;i++) {
    const a=route[i],b=route[i+1];
    // Center corridors join rooms; clicks use the game's own collision-aware path finder.
    for(const p of [[a.x,a.z],[(a.x+b.x)/2,(a.z+b.z)/2],[b.x,b.z]]) {
      if((await museum()).view.phase!=='travelling')return;
      await walk(...p);
    }
  }
  await page.waitForFunction(()=>window.qaView.phase!=='travelling',null,{timeout:15000});
}
async function seriesDialogs() {
  for(let i=0;i<150;i++) {
    const b=page.locator('.series-panel button').filter({hasText:/^(계속|현장으로)$/});
    if(!await b.count()||!await b.isVisible())return;
    await b.click();await page.waitForTimeout(35);
  }
  throw Error('Series dialogue exceeded 150 messages');
}
const series=()=>page.evaluate(()=>window.seriesDiagnostics());
function seriesPath(world,target) {
  const step=.5, nodes=new Map(), queue=[], seen=new Set();
  const clear=(x,z)=>Math.abs(x)<11 && Math.abs(z)<9.8 && !world.boxes.some(b=>Math.hypot(Math.max(b.minX-x,0,x-b.maxX),Math.max(b.minZ-z,0,z-b.maxZ))<.45) && !world.actors.some(a=>a.id!=='moro'&&Math.hypot(x-a.x,z-a.z)<.8);
  const key=(x,z)=>`${x},${z}`;
  let start=null;
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
    const x=Math.round(world.player.x/step)+dx,z=Math.round(world.player.z/step)+dz;
    if(clear(x*step,z*step)&&(!start||Math.hypot(x*step-world.player.x,z*step-world.player.z)<start.d))start={x,z,d:Math.hypot(x*step-world.player.x,z*step-world.player.z)};
  }
  if(!start)return [];
  queue.push(start);seen.add(key(start.x,start.z));
  for(let head=0;head<queue.length;head++) {
    const n=queue[head];
    if(Math.hypot(n.x*step-target.x,n.z*step-target.z)<1.5){const path=[];let k=key(n.x,n.z);while(k){const [x,z]=k.split(',').map(Number);path.unshift({x:x*step,z:z*step});k=nodes.get(k);}return path;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const x=n.x+dx,z=n.z+dz,k=key(x,z);
      if(seen.has(k)||!clear(x*step,z*step)||!clear((x+n.x)*step/2,(z+n.z)*step/2))continue;
      seen.add(k);nodes.set(k,key(n.x,n.z));queue.push({x,z});
    }
  }
  return [];
}
async function seriesGo(id) {
  await checkpoint(`series:${id}`);await page.locator('.series-stage canvas').focus();
  let path=[];
  for(let n=0;n<300;n++) {
    const q=await series(),t=q.world.hotspots.find(h=>h.id===id),a=q.world.player;
    assert.ok(t,`Semantic target ${id} exists`);if(q.world.nearest===id)return;
    if(!path.length||n%15===0)path=seriesPath(q.world,t);
    while(path.length&&Math.hypot(path[0].x-a.x,path[0].z-a.z)<.4)path.shift();
    const point=path[0]??t,dx=point.x-a.x,dz=point.z-a.z,y=q.world.camera.yaw;
    const sx=dx*Math.cos(y)-dz*Math.sin(y),sz=dx*Math.sin(y)+dz*Math.cos(y),keys=[];
    if(Math.abs(sx)>.12)keys.push(sx>0?'d':'a');if(Math.abs(sz)>.12)keys.push(sz>0?'s':'w');
    for(const key of keys)await page.keyboard.down(key);await page.waitForTimeout(70);for(const key of keys)await page.keyboard.up(key);
  }
  throw Error(`Series navigation blocked at ${id}: ${JSON.stringify(await series())}`);
}

try {
  await page.goto(base);
  if(await page.locator('#continue-game').isVisible()) {await page.locator('#continue-game').click();await page.waitForFunction(()=>!document.getElementById('game').hidden);} else await startMuseumGame(page);
  await page.evaluate(async()=>{
    const {createLocalSessions}=await import('./src/local-sessions.mjs');const reader=createLocalSessions({storage:localStorage});
    const id=JSON.parse(localStorage.getItem('museum-local-sessions-v1'))['1'];
    Object.defineProperty(window,'qaView',{get:()=>reader.get(id).view});
  });
  await page.exposeFunction('qaCheckpoint',checkpoint);await page.exposeFunction('qaWorldAction',approach);await page.exposeFunction('qaTravel',travel);
  const driver=(await readFile(new URL('./investigation-browser-driver.js',import.meta.url),'utf8')).trim().replace(/;$/,'');
  await page.evaluate(`(${driver})()`);
  if((await museum()).view.phase==='travelling') await travel();
  if((await museum()).view.sceneId==='O00') {await page.evaluate(()=>window.investigationQA.investigate());await approach('field-action');await travel();}
  const route='S01.A I01.B P12.B S12.A T21.D D22.A S22.B P21.B R31.D S31.A F31.A';
  const remaining=route.split(' '),current=(await museum()).view.sceneId,start=remaining.findIndex(s=>s.split('.')[0]===current);
  for(const step of current==='E1'?[]:remaining.slice(Math.max(0,start))) {
    const [id,choice]=step.split('.');assert.equal((await museum()).view.sceneId,id);
    await page.evaluate(choice=>window.investigationQA.scene(choice),choice);await sample(`museum-${id}`);
  }
  await page.evaluate(()=>window.investigationQA.read());
  assert.equal((await museum()).view.sceneId,'E1');
  await page.screenshot({path:resolve(output,'museum-ending.png')});
  await page.locator('#series-start').click();
  await page.locator('.series-game').waitFor({state:'visible'});
  const companion=page.getByRole('button',{name:'모로와 함께 간다',exact:true});
  if(await companion.isVisible())await companion.click();
  await seriesDialogs();
  await page.waitForFunction(()=>window.seriesDiagnostics?.()?.view&&window.seriesDiagnostics().transition==='idle',null,{timeout:15000});await seriesDialogs();
  for(let n=0;n<120;n++) {
    const q=await series();if(q.view.stage==='complete')break;
    if(q.view.stage==='departure') {
      await sample(`series-${q.view.episodeId}-depart`);await seriesGo('__exit');await page.keyboard.press('e');
      await page.waitForFunction(ep=>window.seriesDiagnostics().view.episodeId!==ep&&window.seriesDiagnostics().transition==='idle',q.view.episodeId,{timeout:15000});await seriesDialogs();continue;
    }
    if(q.view.stage==='perform') {
      await seriesGo(q.view.nextAction);await page.keyboard.press('e');
      await page.waitForFunction(rev=>window.seriesDiagnostics().view.revision>rev,q.view.revision,{timeout:30000});
      await seriesDialogs();continue;
    }
    await seriesGo(q.view.stage==='inspection'?'A':'consult');await page.keyboard.press('e');await seriesDialogs();
    const buttons=page.locator('.series-panel button:not([disabled])').filter({hasNotText:'현장을 더 살펴보기'});
    await buttons.first().click();await seriesDialogs();
  }
  assert.equal((await series()).view.stage,'complete');await sample('series-complete');
  await page.screenshot({path:resolve(output,'series-ending.png')});assert.deepEqual(errors,[]);
} catch(error) {
  errors.push(error.stack);await page.screenshot({path:resolve(output,'failure.png')});throw error;
} finally {
  await writeFile(resolve(output,'report.json'),JSON.stringify({buildHash,samples,errors,final:await page.evaluate(()=>({view:window.qaView,series:window.seriesDiagnostics?.()})).catch(()=>null)},null,2));
  await browser.close();
}
