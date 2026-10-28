const {chromium}=require('/Users/kwanung/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
(async()=>{const b=await chromium.launch({channel:'chromium',headless:true});const p=await b.newPage({viewport:{width:640,height:480}});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await p.route('**/qa-isolated',r=>r.fulfill({contentType:'text/html',body:'<html><head><link rel="stylesheet" href="/series-game.css"></head><body></body></html>'}));await p.goto('http://localhost:5188/qa-isolated');const prior=JSON.parse(fs.readFileSync('artifacts/series-integration-qa/semantic-path-complete.json')).final.view;const m=await import('../../src/series-state.mjs');const record=m.saveSeries(prior);await p.evaluate(async record=>{localStorage.setItem('return-path-series-v2:qa-isolated',JSON.stringify(record));window.qa=await(await import('/series-game.mjs')).mountSeriesGame({museumView:record.museum,sessionId:'qa-isolated',storage:localStorage})},record);
const d=()=>p.evaluate(()=>qa.diagnostics());const log=[];
async function dialogs(){for(let i=0;i<120;i++){let btn=p.locator('.series-panel button').filter({hasText:/^(계속|현장으로)$/});if(!await btn.count()||!await btn.isVisible())break;await btn.click();await p.waitForTimeout(60)}}
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

try{await dialogs();for(let n=0;n<100;n++){const q=await d();log.push(q);console.log('STATE',q.view.episodeId,q.view.stage,q.view.revision);if(q.view.stage==='complete')break;if(q.view.stage==='departure'){await go('__exit');await p.keyboard.press('e');await p.waitForTimeout(5500);await dialogs();continue}if(q.view.stage==='inspection'){await go('A');await p.keyboard.press('e');await dialogs();}else if(q.view.stage==='perform'){const target=await p.evaluate(async()=> (await import('/series-action-plan.mjs')).actionPlanFor(qa.diagnostics().view).nextAction.target);await go(target);const revision=q.view.revision;await p.keyboard.press('e');await p.waitForFunction(r=>qa.diagnostics().view.revision>r&&!qa.diagnostics().performing,revision,{timeout:15000});await dialogs();continue}else{await go('consult');await p.keyboard.press('e');await dialogs();}const buttons=p.locator('.series-panel button:not([disabled])');const first=buttons.filter({hasNotText:'현장을 더 살펴보기'}).first();await first.click();await dialogs();}await p.screenshot({path:'artifacts/series-integration-qa/resumed-complete.png'});}catch(e){errors.push(e.stack);await p.screenshot({path:'artifacts/series-integration-qa/blocker.png'});}fs.writeFileSync('artifacts/series-integration-qa/resumed-complete.json',JSON.stringify({errors,log,final:await d()},null,2));console.log('ERRORS',errors);await b.close()})();
