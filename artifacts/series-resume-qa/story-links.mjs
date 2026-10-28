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

import {createHash} from 'node:crypto';
const hashes={};p.on('response',async r=>{if(/\/(series-game|series-state|series-content)\.mjs$/.test(new URL(r.url()).pathname)){try{hashes[new URL(r.url()).pathname]=createHash('sha256').update(await r.body()).digest('hex');}catch{}}});
try{
let s=createSeries({sceneId:'E1',flags:{}});for(const c of ['A','C','A','C']){if(s.stage==='inspection')s=dispatchSeries(s,{type:'explore',target:c});s=dispatchSeries(s,{type:'choose',choice:c});}for(let i=0;i<2;i++)s=dispatchSeries(s,{type:'perform',action:actionPlanFor(s).nextAction.id});const saved=saveSeries(s),events=JSON.stringify(saved.events);await load(s);await go('handoff-map');const revision=s.revision;await p.locator('.series-stage >button').click();await p.waitForFunction(r=>qa.diagnostics().view.revision>r,revision,{timeout:12000});let messages=[];for(let i=0;i<80;i++){const btn=p.locator('.series-panel button').filter({hasText:/^(계속|현장으로)$/});if(!await btn.count()||!await btn.isVisible())break;messages.push(await p.locator('.series-panel').innerText());await btn.click();await p.waitForTimeout(30);}let q=await d();const objective=await p.locator('.series-hud p').innerText();assert.equal(q.view.stage,'departure');assert.equal(q.view.nextEpisodeId,4);assert.match(messages.join('\n'),/수리소/);assert.match(messages.join('\n'),/표지와 안내에 필요한 현장 장비/);assert.match(objective,/수리소로 이동/);assert.equal(JSON.stringify(q.view.events.slice(0,-1)),events);assert.equal(q.view.events.at(-1).type,'perform');checks.push({check:'ep2-final-real-caption-story-bridge',status:'passed',explicitFixture:true,messages,objective,nextEpisodeId:q.view.nextEpisodeId,revision:q.view.revision,unchangedPreviousEvents:true});await p.screenshot({path:out+'/story-link-boundary.png'});
}catch(e){errors.push(e.stack);console.error(e);}finally{fs.writeFileSync(out+'/story-link-report.json',JSON.stringify({checks,errors,loadedModuleHashes:hashes,final:await d()},null,2));console.log(JSON.stringify({checks,errors,hashes},null,2));await b.close();}
