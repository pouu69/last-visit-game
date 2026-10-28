import {chromium} from '/Users/kwanung/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
import {createSeries,dispatchSeries,saveSeries} from '../../src/series-state.mjs';
import {actionPlanFor} from '../../public/series-action-plan.mjs';
const out='artifacts/series-resume-qa';const b=await chromium.launch({headless:true,channel:'chromium'});const p=await b.newPage({viewport:{width:640,height:480}});const errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('**/qa-boundaries',r=>r.fulfill({contentType:'text/html',body:'<html><head><link rel="stylesheet" href="/series-game.css"></head><body><script type="module">window.qa=await(await import("/series-game.mjs")).mountSeriesGame({museumView:{sceneId:"E1",phase:"terminal",flags:{}},sessionId:"qa-boundaries",storage:localStorage});</script></body></html>'}));
await p.goto('http://localhost:5188/qa-boundaries');const key='return-path-series-v2:qa-boundaries';const d=()=>p.evaluate(()=>qa.diagnostics());
async function load(state){const record={...saveSeries(state),presentation:{seen:[2,3,4,5],cursor:0}};await p.evaluate(({key,record})=>localStorage.setItem(key,JSON.stringify(record)),{key,record});await p.reload();await p.waitForFunction(()=>Boolean(window.qa?.diagnostics().view));}
async function dialogs(){for(let i=0;i<120;i++){let btn=p.locator('.series-panel button').filter({hasText:/^(계속|현장으로)$/});if(!await btn.count()||!await btn.isVisible())break;await btn.click();await p.waitForTimeout(40);}}
async function go(id){
 await p.locator('.series-stage canvas').focus();
 for(let n=0;n<220;n++){
  const q=await d(),w=q.world,t=w.hotspots.find(h=>h.id===id),a=w.player;
  if(w.nearest===id)return;
  const free=(x,z)=>Math.abs(x)<11.4&&Math.abs(z)<9.5&&!w.boxes.some(b=>x>b.minX-.43&&x<b.maxX+.43&&z>b.minZ-.43&&z<b.maxZ+.43)&&!(w.actors??[]).some(b=>b.id!=='moro'&&Math.hypot(x-b.x,z-b.z)<.8);
  const sx=Math.round(a.x*2),sz=Math.round(a.z*2),key=(x,z)=>`${x},${z}`,queue=[[sx,sz]],prev=new Map([[key(sx,sz),null]]);let end=null;
  for(let i=0;i<queue.length;i++){const [x,z]=queue[i];if(Math.hypot(x/2-t.x,z/2-t.z)<1.6){end=[x,z];break;}for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,k=key(nx,nz);if(!prev.has(k)&&free(nx/2,nz/2)){prev.set(k,[x,z]);queue.push([nx,nz]);}}}
  if(!end)throw Error('No collision-free approach '+id+' '+JSON.stringify(w));
  const route=[];for(let node=end;node;node=prev.get(key(...node)))route.unshift(node);
  const waypoint=route[Math.min(1,route.length-1)],dx=waypoint[0]/2-a.x,dz=waypoint[1]/2-a.z,y=w.camera.yaw,rx=dx*Math.cos(y)-dz*Math.sin(y),rz=dx*Math.sin(y)+dz*Math.cos(y),keys=[];
  if(Math.abs(rx)>.08)keys.push(rx>0?'d':'a');if(Math.abs(rz)>.08)keys.push(rz>0?'s':'w');
  for(const k of keys)await p.keyboard.down(k);await p.waitForTimeout(150);for(const k of keys)await p.keyboard.up(k);
  if(n%20===0)console.log('PATH',id,n,a);
 }
 throw Error('Navigation budget '+id+' '+JSON.stringify(await d()));
}

const real=JSON.parse(fs.readFileSync('artifacts/series-integration-qa/resumed-complete.json'));const first=real.log.find(x=>x.view.episodeId===5&&x.view.stage==='perform').view;
function select(s,c){if(s.stage==='inspection')s=dispatchSeries(s,{type:'explore',target:c});return dispatchSeries(s,{type:'choose',choice:c});}
function fixture(prepared){let s=createSeries({sceneId:'E1',flags:{}});while(s.episodeId!==5){const ep=s.episodeId;for(const c of prepared?(ep===2?['D','C','A','B']:ep===3?['B','A','B','C']:['B','B','A','B']):['A','D','B','B'])s=select(s,c);while(s.stage==='perform')s=dispatchSeries(s,{type:'perform',action:actionPlanFor(s).nextAction.id});s=dispatchSeries(s,{type:'depart'});}for(const c of ['A','C','D'])s=select(s,c);return s;}
try{
await load(first);assert.equal((await d()).view.revision,31);await p.locator('.series-stage >button').click();await p.waitForFunction(()=>qa.diagnostics().performing);await p.waitForTimeout(150);await p.reload();await p.waitForFunction(()=>window.qa?.diagnostics().view);let q=await d();assert.equal(q.view.revision,31);assert.equal(q.performing,false);assert.deepEqual(q.view.episodes[5].completedActions,[]);checks.push({check:'reload-in-progress',status:'passed',revision:q.view.revision,choices:q.view.episodes[5].choices});
await p.locator('.series-stage >button').click();await p.waitForFunction(()=>qa.diagnostics().performing);await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});q=await d();assert.equal(q.performing,false);assert.equal(q.view.revision,31);await p.waitForTimeout(2500);assert.equal((await d()).view.revision,31);await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await p.locator('.series-stage >button').click();await p.waitForFunction(()=>qa.diagnostics().view.revision===32);await p.waitForTimeout(300);q=await d();assert.equal(q.view.episodes[5].completedActions.filter(x=>x==='meet-yeonwoo').length,1);checks.push({check:'hide-cancel-native-caption-retry-once',status:'passed',revision:q.view.revision});
await p.reload();await p.waitForFunction(()=>window.qa?.diagnostics().view);q=await d();assert.equal(q.view.revision,32);checks.push({check:'reload-action-boundary',status:'passed',revision:q.view.revision});
// Instrument actual current audio context via prototype; unlock through native button then mute.
const audio=await p.evaluate(async()=>{const a=(await import('/audio.mjs')).gameAudio;return a.diagnostics();});checks.push({check:'audio-state',diagnostics:audio});
for(const prepared of [true,false]){const state=fixture(prepared);await load(state);await go('consult');await p.keyboard.press('e');await dialogs();const labels=await p.locator('.series-panel button').allTextContents();await p.locator('.series-panel button:not([disabled])').filter({hasNotText:'현장을 더 살펴보기'}).first().click();await dialogs();q=await d();assert.equal(q.view.stage,'perform');const outcome=q.view.episodes[5].outcome;assert.equal(outcome,prepared?'C':'D');checks.push({check:prepared?'ready-mobile-C-selection':'deficient-C-fallback-selection',status:'passed',labels,outcome,facts:q.view.facts,readiness:q.view.readiness});}
// Explicit synthetic canonical checkpoint after outward walk; saved event sequence replay projection.
let wb=fixture(true);const pre=wb.events.slice(0,-2);let base=createSeries(wb.museum);for(const e of pre)base=dispatchSeries(base,e);for(const c of ['B','D','A'])base=select(base,c);while(actionPlanFor(base).nextAction.id!=='return-walk')base=dispatchSeries(base,{type:'perform',action:actionPlanFor(base).nextAction.id});await load(base);q=await d();assert.deepEqual(q.world.player,{x:0,z:-4});const before=JSON.stringify({choices:q.view.episodes[5].choices,completed:q.view.episodes[5].completedActions,player:q.world.player});await p.reload();await p.waitForFunction(()=>window.qa?.diagnostics().view);q=await d();assert.equal(JSON.stringify({choices:q.view.episodes[5].choices,completed:q.view.episodes[5].completedActions,player:q.world.player}),before);checks.push({check:'canonical-walk-reload-position',status:'passed',revision:q.view.revision,player:q.world.player});
await p.screenshot({path:out+'/boundary.png'});
}catch(e){errors.push(e.stack);console.error(e);await p.screenshot({path:out+'/failure.png'});}finally{fs.writeFileSync(out+'/report.json',JSON.stringify({explicitFixtures:true,checks,errors,final:await d()},null,2));console.log(JSON.stringify({checks,errors},null,2));await b.close();}
