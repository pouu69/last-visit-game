import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeries,dispatchSeries,saveSeries,restoreSeries} from '../src/series-state.mjs';
import {actionPlanFor,WALK_FORMATION,actorRouteFor} from '../public/series-action-plan.mjs';

function select(state,choice) {
  if(state.stage==='inspection') state=dispatchSeries(state,{type:'explore',target:choice});
  return dispatchSeries(state,{type:'choose',choice});
}
function execute(state) {
  while(state.stage==='perform') {
    const plan=actionPlanFor(state);
    assert.ok(plan.nextAction && Number.isFinite(plan.nextAction.x));
    const before=JSON.stringify(state.facts);
    state=dispatchSeries(state,{type:'perform',action:plan.nextAction.id});
    assert.equal(JSON.stringify(state.facts),before,'physical execution cannot grant missing preparation');
    assert.deepEqual(actionPlanFor(state),actionPlanFor(restoreSeries(saveSeries(state))));
  }
  return state;
}
test('every canonical branch has authored actions and identical replay projections',()=>{
  const seen=new Set();
  // Exercise each middle branch and both final choices under ready and unready facts.
  for(const prepared of [false,true]) for(const branch of ['A','B','C','D']) for(const finalPlan of ['A','B','C','D']) for(const endingChoice of ['A','B']) {
    let state=createSeries({sceneId:'E1',flags:{}});
    while(state.episodeId!==5) {
      const ep=state.episodeId;
      for(const choice of prepared?(ep===2?['D','C','A',branch]:ep===3?['B','A','A',branch]:['B','B','B',branch]):['A','D','B',branch]) state=select(state,choice);
      for(const a of actionPlanFor(state).actions) seen.add(a.id);
      state=execute(state); state=dispatchSeries(state,{type:'depart'});
    }
    for(const choice of ['A',finalPlan,'D',endingChoice]) state=select(state,choice);
    for(const a of actionPlanFor(state).actions) seen.add(a.id);
    state=execute(state);
    assert.equal(state.stage,'complete');
  }
  assert.ok(seen.has('second-return-walk') && seen.has('repeat-short-trial') && seen.has('station-role'));
});
test('unverified return sign stays stored and demo cannot install it',()=>{
  let state=createSeries({sceneId:'E1',flags:{}});
  for(const choice of ['B','D','B','B'])state=select(state,choice);
  state=execute(state);
  const plan=actionPlanFor(state);
  assert.equal(state.facts.routeSurvey,false);
  assert.equal(plan.projection['back-sign'].z,-6);
  assert.equal(plan.projection['out-sign'].z,0);
});

test('unverified carrier stays at workshop and receives no free transport trial',()=>{
  let state=createSeries({sceneId:'E5',flags:{}});
  for(const choice of ['D','A','B','B'])state=select(state,choice);
  const plan=actionPlanFor(state);
  assert.equal(plan.actions.find(a=>a.id==='lower-carry-height').motion,'write');
  state=execute(state);
  assert.equal(state.facts.mobileLight,false);
  assert.equal(actionPlanFor(state).projection.carrier.z,-6);
});

// Geometry comes from the shipped models, including their authored passable holes.
import * as THREE from 'three';
import {createAssetCore,MUSEUM_PALETTE} from '../public/assets/shared/core.mjs';
import {createEpisode03Props} from '../public/assets/episodes/ep-03/props.mjs';
import {createEpisode04Props} from '../public/assets/episodes/ep-04/props.mjs';
import {createEpisode05Props} from '../public/assets/episodes/ep-05/props.mjs';
import {createMuseumProps} from '../public/assets/episodes/ep-01/props.mjs';
import {collectStaticColliders} from '../public/museum-colliders.mjs';
test('river walking and greeting choreography clears shipped props and support desks',(t)=>{
  const geometries=[],materials=[];
  const material=(color)=>{const m=new THREE.MeshStandardMaterial({color});materials.push(m);return m;};
  const paint=Object.fromEntries(Object.entries(MUSEUM_PALETTE).map(([id,c])=>[id,material(c)]));
  const core=createAssetCore(THREE,{geometry:g=>(geometries.push(g),g),material,paint,glass:material('#aaaaaa'),signal:material('#ddddaa'),waterPaint:material('#559999'),contact:material('#555555')});
  t.after(()=>{geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());});
  const kits={1:createMuseumProps(core),3:createEpisode03Props(core),4:createEpisode04Props(core),5:createEpisode05Props(core)};
  const ids=['outward-walk','return-walk','second-outward-walk','second-return-walk','short-outward-walk','short-return-walk','repeat-short-trial','return-station','meet-yeonwoo','station-welcome','junction-welcome','shelter-welcome','confirm-every-person'];
  const initial=createSeries({sceneId:'E1',flags:{}});
  const state={...initial,episodeId:5,stage:'perform',episodes:{...initial.episodes,5:{...initial.episodes[5],requiredActions:ids}}};
  const plan=actionPlanFor(state),boxes=[];
  for(const o of plan.objects){
    const asset=kits[o.assetEpisode].create(o.assetId);asset.group.position.set(o.x,o.y,o.z);
    boxes.push(...collectStaticColliders(asset.group));
    if(o.y>.8)boxes.push({minX:o.x-.75,maxX:o.x+.75,minZ:o.z-.45,maxZ:o.z+.45});
  }
  function clear(route,radius,label){
    for(let i=1;i<route.length;i++)for(let j=0;j<=100;j++){
      const f=j/100,x=route[i-1][0]*(1-f)+route[i][0]*f,z=route[i-1][1]*(1-f)+route[i][1]*f;
      for(const b of boxes)assert.ok(Math.hypot(Math.max(b.minX-x,0,x-b.maxX),Math.max(b.minZ-z,0,z-b.maxZ))>=radius-1e-6,`${label} intersects prop at ${x},${z}`);
    }
  }
  const positions=Object.fromEntries(Object.entries(WALK_FORMATION).map(([id,x])=>[id,[x,6]]));
  for(const a of plan.actions){
    if(a.path){
      clear(a.path,.38,a.id+' player');
      const routes=[a.path,...Object.keys(WALK_FORMATION).map(actor=>actorRouteFor(a,actor,[a.path[0][0]+WALK_FORMATION[actor],a.path[0][1]]))];
      const sample=(route,t)=>{
        const lengths=route.slice(1).map((p,i)=>Math.hypot(p[0]-route[i][0],p[1]-route[i][1]));
        let d=t*lengths.reduce((a,b)=>a+b,0),i=0;
        while(i<lengths.length-1&&d>lengths[i])d-=lengths[i++];
        const f=lengths[i]?d/lengths[i]:1;
        return route[i].map((v,k)=>v*(1-f)+route[i+1][k]*f);
      };
      for(let step=0;step<=100;step++){
        const points=routes.map(r=>sample(r,step/100));
        for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)
          assert.ok(Math.hypot(points[i][0]-points[j][0],points[i][1]-points[j][1])>=(i===0?.73:.70)-1e-6,`${a.id} participants overlap at ${step}%`);
      }
    }
    for(const actor of Object.keys(positions)){
      const route=actorRouteFor(a,actor,positions[actor]);if(!route)continue;
      clear(route,.35,a.id+' '+actor);positions[actor]=route.at(-1);
    }
  }
});
