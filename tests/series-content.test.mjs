import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSeriesContent} from '../src/series-content.mjs';
import {createSeries,dispatchSeries,getSeriesView,nextEpisodeFor} from '../src/series-state.mjs';
const content=await loadSeriesContent();
const museum=id=>({sceneId:id,flags:{boat:'sealed',record:'unreadable',moro:'asleep'}});
const send=(s,type,fields={})=>dispatchSeries(s,{type,...fields});
const text=messages=>messages.map(m=>m.text).join('\n');
test('all four episodes have source-backed exploration, choices, results and endings',()=>{
 let s=createSeries(museum('E1'));
 for(let guard=0;guard<100&&s.stage!=='complete';guard++){
  if(s.stage==='inspection') {
   assert.ok(content.intro(s).length>=5);
   assert.ok(content.inspection(s,'A').length>0);
   assert.equal(content.choices(s).length,4);
   s=send(s,'explore',{target:'A'});
  }
  if(['inspection','deduction','time','plan','repair','execution'].includes(s.stage)) {
   const opts=content.choices(s);
   assert.equal(opts.length,(s.stage==='time'||s.episodeId===5&&s.stage==='execution')?2:4);
   assert.ok(opts.every(o=>o.label.length>3));
   s=send(s,'choose',{choice:'A'});
   assert.ok(content.result(s).length>0);
  } else if(s.stage==='perform') s=send(s,'perform',{action:getSeriesView(s).nextAction});
  else if(s.stage==='departure') {assert.ok(content.ending(s).length>0);s=send(s,'depart');}
 }
 assert.equal(s.stage,'complete');
 assert.match(text(content.ending(s)),/돌아갈 길/);
});
test('bridge preserves ending-specific invite and optional companion',()=>{
 for(const id of ['E1','E2','E3','E4','E5','E6']) {
  const a=content.bridge(museum(id),false),b=content.bridge(museum(id),true);
  assert.ok(a.length>10);assert.ok(b.length>10);
  assert.match(text(a),/인계 장소/);
  assert.match(text(b),/접속부 봉인/);
  assert.ok(a.every(m=>m.speaker!=='모로'));
 }
});
test('all six visit orders announce the actual next place before departure',()=>{
 const routes=[['E1','A','A',[2,3,4]],['E1','B','B',[2,4,3]],['E3','C','B',[3,2,4]],['E3','A','A',[3,4,2]],['E5','A','A',[4,2,3]],['E5','B','C',[4,3,2]]];
 const places={2:'종착역',3:'작은 극장',4:'수리소'};
 for(const [start,first,second,order] of routes) {
  let s=createSeries(museum(start));
  for(const [i,id] of order.entries()) {
   assert.equal(s.episodeId,id);
   s=send(s,'explore',{target:'A'});
   for(const choice of ['A','A','A',i===0?first:i===1?second:'A'])s=send(s,'choose',{choice});
   while(s.stage==='perform')s=send(s,'perform',{action:getSeriesView(s).nextAction});
   const next=order[i+1]??5, before=JSON.stringify(s), words=text(content.ending(s));
   assert.equal(nextEpisodeFor(s),next);
   assert.equal(getSeriesView(s).nextEpisodeId,next);
   if(next===5)assert.match(words,/세 곳에서 돌아오셨네요.*역 뒤뜰에서 만나 위쪽 쉼터/);
   else assert.ok(words.includes(`다음 목적지는 ${places[next]}이다.`));
   assert.equal(JSON.stringify(s),before,'preview must not mutate the saved journey');
   const preferred=nextEpisodeFor({...s,visited:[]});
   assert.equal(words.includes('같은 일을 다시 부탁할 필요는 없겠네요'),next!==preferred);
   if(next!==preferred)assert.doesNotMatch(words,/극장.*(주세요|맞추세요)|수리소.*주세요|역에서 정할|밝은 시간에 길을 먼저 확인/);
   s=send(s,'depart');assert.equal(s.episodeId,next);
  }
 }
});
test('unvisited requests remain, while completed destinations never receive a new request',()=>{
 for(const [start,id] of [['E1',2],['E3',3],['E5',4]])for(const choice of ['A','B','C','D']) {
  let s=createSeries(museum(start));
  s=send(s,'explore',{target:'A'});
  for(const c of ['A','A','A',choice])s=send(s,'choose',{choice:c});
  while(s.stage==='perform')s=send(s,'perform',{action:getSeriesView(s).nextAction});
  const preferred=nextEpisodeFor(s), original=text(content.ending(s));
  assert.doesNotMatch(original,/같은 일을 다시 부탁/);
  const visited={...s,visited:[...s.visited,preferred]}, replaced=text(content.ending(visited));
  assert.match(replaced,/같은 일을 다시 부탁/);
  assert.doesNotMatch(replaced,/극장.*(주세요|맞추세요)|수리소.*주세요|역에서 정할|밝은 시간에 길을 먼저 확인/);
  if(id===2&&choice==='A')assert.match(original,/극장에 남은 녹음도 확인해 주세요/);
  if(id===3&&choice==='D')assert.doesNotMatch(original,/극장을 나올 때/);
 }
});
test('non-companion final includes handoff message, never on-site robot speech',()=>{
 let s=createSeries(museum('E2'));
 while(s.stage!=='complete') {
  if(s.stage==='inspection')s=send(s,'explore',{target:'A'});
  if(['inspection','deduction','time','plan','repair','execution'].includes(s.stage))s=send(s,'choose',{choice:'A'});
  else if(s.stage==='perform')s=send(s,'perform',{action:getSeriesView(s).nextAction});
  else s=send(s,'depart');
 }
 const ending=content.ending(s);
 assert.ok(ending.every(m=>m.speaker!=='모로'));
 assert.match(text(ending),/인계 담당자에게 종료/);
 assert.doesNotMatch(text(ending),/오늘의 출발점으로 돌아왔습니다/);
 assert.match(text(content.followup(s)),/사흘 뒤/);
 assert.match(text(content.followup(s)),/번진 원본 장부는 그대로/);
});

function finishWith({moroAccompanies=false,attends=false,plan='D',action='B',handover=false}={}) {
 let s=createSeries(museum('E2'),{moroAccompanies});
 const choices={2:['A','C','A','B'],3:[attends?'D':'B','A','B','C'],4:['B','B',handover?'B':'A','B'],5:['B',plan,'A',action]};
 while(s.stage!=='complete') {
  if(s.stage==='inspection')s=send(s,'explore',{target:choices[s.episodeId][0]});
  const i=(s.episodeId===5?['inspection','plan','repair','execution']:['inspection','deduction','time','execution']).indexOf(s.stage);
  if(i>=0)s=send(s,'choose',{choice:choices[s.episodeId][i]});
  else if(s.stage==='perform')s=send(s,'perform',{action:getSeriesView(s).nextAction});
  else s=send(s,'depart');
 }
 return s;
}
test('robot farewell and the team charging reply are one conditional exchange',()=>{
 for(const accompanies of [false,true]) {
  const s=finishWith({moroAccompanies:accompanies});
  const ending=content.ending(s), words=text(ending);
  assert.equal(ending.some(m=>m.speaker==='모로'),accompanies);
  assert.equal(words.includes('인계한 곳으로 같이 돌아가 충전하죠.'),accompanies);
  assert.equal(words.includes('인계 담당자에게 종료 소식을 보낸다.'),!accompanies);
 }
});
test('final attendance and cleanup use actual participation and handover state',()=>{
 for(const attends of [false,true])for(const handover of [false,true]) {
  const s=finishWith({attends,handover});
  const intro=text(content.intro(s)), ending=text(content.ending(s));
  assert.equal(intro.includes('정연이 의자를 가져온다'),attends);
  assert.equal(intro.includes('오늘은 가지 않을게요'),!attends);
  assert.equal(ending.includes('이든이 다음 점검을 받는다'),handover);
  assert.equal(ending.includes('태오의 보관·점검 책임을 유지'),!handover);
  if(!handover)assert.doesNotMatch(ending,/출고한 조명은 이든에게|출고한 조명은 점검을 인수한 이든에게/);
  assert.doesNotMatch(ending,/인수 완료:|인수 미완료:|완료됐다면|아니라면/);
 }
});
test('final ending describes only the actual action instead of both authored alternatives',()=>{
 for(const plan of ['A','B','C'])for(const action of ['A','B']) {
  const s=finishWith({plan,action});
  const ending=text(content.ending(s));
  assert.doesNotMatch(ending,/A는 |B는 |A의 반복|B의 공동/);
  if(plan==='B')assert.match(ending,action==='A'?/한 대열이 출발하고 돌아온/:/두 차례 왕복하며 다음 안내자/);
  if(plan==='C')assert.match(ending,action==='A'?/세 접점에서 같은 인사와 신호/:/장소마다 길 안내, 신호, 종이 전달/);
 }
});
