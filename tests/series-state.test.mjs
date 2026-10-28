import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeries,dispatchSeries,getSeriesView,saveSeries,restoreSeries,seriesReadiness} from '../src/series-state.mjs';
const museum = ending=>({sceneId:ending,flags:{boat:'sealed',record:'unreadable',moro:'asleep'},teamId:1});
const send=(s,type,fields={})=>dispatchSeries(s,{type,...fields});
function episode(s,choices) {
  s=send(s,'explore',{target:choices[0]});
  for(const choice of choices) s=send(s,'choose',{choice});
  while(s.stage==='perform') s=send(s,'perform',{action:getSeriesView(s).nextAction});
  return s;
}
function middle(s,plans) {
  while(s.episodeId!==5) {s=episode(s,plans[s.episodeId]);s=send(s,'depart');}
  return s;
}
const paths={2:['D','C','A','A'],3:['B','A','A','A'],4:['A','B','B','A']};
test('384 ending combinations visit each middle episode exactly once, across six orders',()=>{
 const orders=new Set();
 for(const ending of ['E1','E2','E3','E4','E5','E6']) for(const a of 'ABCD') for(const b of 'ABCD') for(const c of 'ABCD') {
   const s=middle(createSeries(museum(ending)),{2:['A','C','A',a],3:['B','A','B',b],4:['B','B','A',c]});
   assert.equal(s.episodeId,5);assert.equal(new Set(s.visited).size,4);
   orders.add(s.visited.join(','));
 }
 assert.equal(orders.size,6);
});
test('inspection evidence, physical action order, duplicate input and departure are enforced',()=>{
 const initial=createSeries(museum('E1'));
 assert.throws(()=>send(initial,'choose',{choice:'A'}));
 assert.throws(()=>send(initial,'depart'));
 let s=send(initial,'explore',{target:'A'});
 assert.throws(()=>dispatchSeries(s,{type:'choose',choice:'A',revision:0}));
 for(const choice of ['A','C','A','B']) s=send(s,'choose',{choice});
 assert.equal(s.stage,'perform'); assert.deepEqual(s.visited,[1]);
 assert.throws(()=>send(s,'depart'));
 assert.throws(()=>send(s,'perform',{action:'check-return-sign'}));
 s=send(s,'perform',{action:'assemble-signs'});
 assert.throws(()=>send(s,'perform',{action:'assemble-signs'}));
 assert.deepEqual(initial.episodes[2].explored,[]);
});
test('survey does not grant escort, invitation does not grant signal, form trial does not grant handover',()=>{
 const s=middle(createSeries(museum('E1')),{2:['B','D','A','D'],3:['A','D','A','D'],4:['A','D','A','A']});
 assert.equal(s.facts.routeSurvey,true);assert.equal(s.facts.escort,false);
 assert.equal(s.facts.jungyeonAttends,true);assert.equal(s.facts.signal,false);
 assert.equal(s.facts.fixedLight,true);assert.equal(s.facts.handover,false);
 assert.equal(seriesReadiness(s).route,false);
});
test('one repair never clears multiple deficits; every requested scope has a safe actual ending',()=>{
 const base=middle(createSeries(museum('E2')),{2:['B','A','B','B'],3:['A','D','A','A'],4:['D','A','B','A']});
 assert.deepEqual([seriesReadiness(base).route,seriesReadiness(base).signal,seriesReadiness(base).equipment],[false,false,false]);
 for(const repair of 'ABCD') for(const plan of 'ABCD') for(const last of 'AB') {
   const s=episode(base,['A',plan,repair,last]);
   assert.equal(s.stage,'complete');
   assert.ok(['강가의 빈자리','다음 사람이 아는 길'].includes(s.ending));
   assert.equal(Object.values({route:seriesReadiness(s).route,signal:s.facts.signal,equipment:seriesReadiness(s).equipment}).filter(Boolean).length,repair==='D'?0:1);
 }
});
test('fixed lighting supports public walk but never three contact mobile program',()=>{
 const base=middle(createSeries(museum('E1')),paths);
 assert.equal(seriesReadiness(base).publicReady,true);assert.equal(seriesReadiness(base).mobileReady,false);
 const s=episode(base,['B','C','D','A']);
 assert.equal(s.ending,'왕복길의 첫날');
 assert.equal(s.episodes[5].completedActions.includes('outward-walk'),true);
 assert.equal(s.episodes[5].completedActions.includes('collect-equipment'),true);
 assert.equal(s.episodes[5].completedActions.at(-1),'close-gathering');
});
test('all current states restore by replay, preserving original museum loss separately from later recovery',()=>{
 let s=createSeries(museum('E5'),{moroAccompanies:true});
 for(let i=0;i<100 && s.stage!=='complete';i++) {
   assert.deepEqual(restoreSeries(saveSeries(s)),s);
   if(s.stage==='inspection') {s=send(s,'explore',{target:'A'});s=send(s,'choose',{choice:'A'});}
   else if(s.stage==='perform') s=send(s,'perform',{action:getSeriesView(s).nextAction});
   else if(s.stage==='departure') s=send(s,'depart');
   else s=send(s,'choose',{choice:'A'});
 }
 assert.equal(s.stage,'complete');
 assert.equal(s.museum.flags.boat,'sealed');assert.equal(s.museum.flags.record,'unreadable');
 assert.equal(s.followup.boat,'late-return-after-unsealing');assert.equal(s.followup.record,'unreadable');
 assert.equal(s.followup.originalBoatAvailable,false);
 const bad=structuredClone(saveSeries(s));bad.events[0].target='D';assert.throws(()=>restoreSeries(bad));
});
test('canonical six manuscript paths produce their stated scope',()=>{
 const cases=[
 ['E1',{2:['D','C','A','A'],3:['B','A','A','A'],4:['A','B','B','A']},['B','B','D','A'],'왕복길의 첫날'],
 ['E2',{2:['C','C','B','B'],3:['D','A','B','D'],4:['C','B','B','B']},['A','C','D','B'],'한곳에 모이지 않는 모임'],
 ['E3',{2:['B','B','B','C'],3:['A','B','A','C'],4:['D','C','B','D']},['C','B','A','A'],'강가의 빈자리'],
 ['E4',{2:['B','D','A','D'],3:['B','A','A','B'],4:['D','A','A','C']},['D','B','A','B'],'왕복길의 첫날'],
 ['E5',{2:['B','A','A','A'],3:['D','C','B','C'],4:['B','D','B','D']},['A','C','A','A'],'왕복길의 첫날'],
 ['E6',{2:['C','C','B','B'],3:['A','D','A','D'],4:['A','B','A','C']},['B','D','D','B'],'다음 사람이 아는 길']];
 for(const [ending,p,final,expected] of cases) assert.equal(episode(middle(createSeries(museum(ending)),p),final).ending,expected);
});
