import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAssetCore, MUSEUM_PALETTE } from '../public/assets/shared/core.mjs';
import { createEpisode02Props } from '../public/assets/episodes/ep-02/props.mjs';
import { createEpisode03Props } from '../public/assets/episodes/ep-03/props.mjs';
import { createEpisode04Props } from '../public/assets/episodes/ep-04/props.mjs';
import { createEpisode05Props } from '../public/assets/episodes/ep-05/props.mjs';
import { createSeriesActors } from '../public/assets/episodes/ep-02/actors.mjs';
function coreFixture(t){const gs=new Set(),ms=new Set();const geometry=x=>(gs.add(x),x);const material=(c,o={})=>(ms.add(new THREE.MeshStandardMaterial({color:c,...o})),[...ms].at(-1));const paint=Object.fromEntries(Object.entries(MUSEUM_PALETTE).map(([k,c])=>[k,material(c)]));const core=createAssetCore(THREE,{geometry,material,paint,glass:material('#85aaa0',{transparent:true,opacity:.3}),signal:material('#c9dbb0'),waterPaint:material('#548a88',{transparent:true,opacity:.78}),contact:material('#384b3d',{transparent:true,opacity:.17})});t.after(()=>{gs.forEach(x=>x.dispose());ms.forEach(x=>x.dispose())});return core;}
const expected={
 '02':['route-sign','double-sign','sign-stand','return-crate','folded-map','station-clock','stroller','folding-support','platform-bench'],
 '03':['chair','microphone','track-console','signal-cards','score-notes','personal-player','timing-board','open-circle'],
 '04':['guide-lamp','fixed-stand','carrying-base','hand-signs','inspection-documents','shade-panel','wall-lamp-mount'],
 '05':['water-basin','paper-stack','shelter','role-board','river-path-fork','shelter-bench'],
};
test('episode factories expose distinct full-volume catalogue assets with finite bounds and collider contracts',(t)=>{
 const c=coreFixture(t),factories={'02':createEpisode02Props(c),'03':createEpisode03Props(c),'04':createEpisode04Props(c),'05':createEpisode05Props(c)};
 for(const [ep,ids] of Object.entries(expected)){const f=factories[ep];for(const id of ids){assert.ok(f.ids.includes(id),`${ep}/${id} registered`);const a=f.create(id);assert.ok(a.group?.isGroup,`${ep}/${id} group`);assert.ok(a.parts&&Array.isArray(a.collision),`${ep}/${id} parts and collision`);const b=new THREE.Box3().setFromObject(a.group).getSize(new THREE.Vector3());assert.ok([b.x,b.y,b.z].every(v=>Number.isFinite(v)&&v>.001),`${ep}/${id} has measured 3D bounds`);for(const c of a.group.userData.assetColliders)assert.ok(Object.values(c).every(Number.isFinite)&&c.minX<c.maxX&&c.minY<c.maxY&&c.minZ<c.maxZ,`${ep}/${id} collider`);let meshes=0;a.group.traverse(o=>{if(!o.isMesh)return;meshes++;assert.ok(o.geometry.getAttribute('normal')?.count>0,`${ep}/${id} normals`)});assert.ok(meshes>0,`${ep}/${id} mesh geometry`);}}
});
test('stateful props retain distinct movable or visibility handles',(t)=>{const c=coreFixture(t);const checks=[[createEpisode02Props(c).create('return-crate',{open:true}),['lid']],[createEpisode02Props(c).create('folding-support',{deployed:true}),['legs']],[createEpisode03Props(c).create('signal-cards'),['cards']],[createEpisode03Props(c).create('open-circle'),['chairs']],[createEpisode04Props(c).create('guide-lamp',{lit:true}),['bulb','shade','base']],[createEpisode04Props(c).create('shade-panel'),['hinge','pin']],[createEpisode05Props(c).create('water-basin',{filled:false}),['water']]];for(const [a,keys] of checks)for(const key of keys){const part=a.parts[key];assert.ok(part,`${a.group.name} ${key}`);for(const p of Array.isArray(part)?part:[part])assert.equal(a.group.getObjectById(p.id),p);}});
test('station cast exports the seven authored full-volume actors',(t)=>{const f=createSeriesActors(coreFixture(t));assert.deepEqual([...f.ids].sort(),['ideun','jeongyeon','munjeong','narae','neighbor','sohui','taeo']);for(const id of f.ids){const a=f.create(id);const b=new THREE.Box3().setFromObject(a.group).getSize(new THREE.Vector3());assert.ok(b.x>.4&&b.y>1.35&&b.z>.25,id);assert.equal(a.group.userData.episodeId,'ep-02');assert.ok(a.group.userData.assetColliders.length>0,id);assert.equal(a.group.userData.actorRole?true:false,true,id);}});

test('story details, pivots, catalogue identity, actor grounding, and open circle passage stay accurate',(t)=>{
 const c=coreFixture(t),theatre=createEpisode03Props(c),workshop=createEpisode04Props(c),river=createEpisode05Props(c),cast=createSeriesActors(c);
 const texts=(asset)=>{const out=[];asset.group.traverse(o=>{if(o.userData.labelText)out.push(o.userData.labelText)});return out.join('\n')};
 const score=texts(theatre.create('score-notes')),clock=texts(theatre.create('timing-board'));const tracks=texts(theatre.create('track-console'));
 assert.match(score,/녹음 02:10~02:26/);assert.match(score,/독창 트랙 제거/);assert.match(score,/녹음 02:30~02:46/);assert.doesNotMatch(score,/독창은 나중에 추가|18:0[24]/);
 assert.match(tracks,/녹음 02:00 · 시작 박수/);assert.match(tracks,/제거한 독창 02:30~02:46/);assert.doesNotMatch(tracks,/독창\s+02:00|独唱/);
 assert.match(clock,/녹음 02:00/);assert.match(clock,/영상 00:00/);assert.doesNotMatch(clock,/18:0[24]/);
 const fork=river.create('river-path-fork');assert.equal(fork.group.userData.assetId,'river-path-fork');
 const mount=workshop.create('wall-lamp-mount');assert.equal(mount.pivot,'wall-center');assert.equal(mount.group.userData.assetPivot,'wall-center');
 const circle=theatre.create('open-circle'),bounds=new THREE.Box3().setFromObject(circle.group).getSize(new THREE.Vector3());assert.ok(circle.collision.length>=6);assert.ok(bounds.z>2.7&&circle.footprint[1]>3);
 // A clear, walkable approach remains in front of the open arc (+Z).
 assert.ok(circle.collision.every(box=>box.maxX<-.35||box.minX>.35||box.maxZ<.7), 'front approach is not blocked by chair proxies');
 for(const id of cast.ids){const actor=cast.create(id),box=new THREE.Box3().setFromObject(actor.group);assert.ok(box.min.y>=-.001,`${id} feet sit on the floor`);}
});
