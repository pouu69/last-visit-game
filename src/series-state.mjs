/** Canonical v2 series rules. Narrative and world interactions are supplied by the client.
 * Events: explore {target:A-D}, choose {choice:A-D}, perform {action}, depart.
 * Every event may carry revision. Save records replay validated events, never derived state.
 */
import { sha256 } from './hash.mjs';

export const SERIES_VERSION = 'return-path-v2';
const ABCD = ['A', 'B', 'C', 'D'];
const TITLES = { 2: '종착역의 반대편', 3: '마지막 곡의 빈자리', 4: '수리하지 않는 것', 5: '지도 다음의 길' };
const SCENES = { 2: ['N21','N23','N24','N25'], 3: ['V31','V33','V34','V35'], 4: ['W41','W43','W44','W45'], 5: ['R51','R52','R53','R54'] };
const ENDINGS = { 2: ['철거한 화살표','두 겹의 표지','주머니 속 약도','함께 걷는 길'], 3: ['비워 둔 독창','다시 맞춘 박자','눈으로 세는 시작','한 사람의 청취실'], 4: ['낮은 곳의 빛','들고 가는 불빛','손에서 손으로','아직 켜지 않은 등'], 5: ['강가의 빈자리','왕복길의 첫날','한곳에 모이지 않는 모임','다음 사람이 아는 길'] };
const PRIORITIES = { 2: { A:[3,4], B:[4,3], C:[4,3], D:[3,4] }, 3: { A:[4,2], B:[4,2], C:[2,4], D:[2,4] }, 4: { A:[2,3], B:[3,2], C:[3,2], D:[2,3] } };
const INITIAL = { E1:2, E2:2, E3:3, E4:3, E5:4, E6:4 };
export function nextEpisodeFor(state) {
  const priorities=PRIORITIES[state.episodeId]?.[state.episodes[state.episodeId].choices.execution];
  return priorities ? priorities.find(id=>!state.visited.includes(id)) ?? 5 : null;
}
const stages = id => id === 5 ? ['inspection','plan','repair','execution'] : ['inspection','deduction','time','execution'];
const clone = value => JSON.parse(JSON.stringify(value));
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function assert(condition, message) { if (!condition) throw new Error(message); }
function freshEpisode() { return { choices: {}, explored: [], requiredActions: [], completedActions: [], ending: null }; }

export function createSeries(museumView, { moroAccompanies = false } = {}) {
  assert(museumView && INITIAL[museumView.sceneId], '박물관 엔딩을 마친 뒤 연작을 시작하세요.');
  const museum = clone(museumView);
  return freeze({ version:SERIES_VERSION, museum, moroAccompanies:Boolean(moroAccompanies),
    episodeId:INITIAL[museum.sceneId], stage:'inspection', revision:0, visited:[1],
    episodes:{ 2:freshEpisode(),3:freshEpisode(),4:freshEpisode(),5:freshEpisode() },
    facts:{ routeSurvey:false, escort:false, signal:false, jungyeonAttends:false,
      fixedLight:false, mobileLight:false, handover:false },
    followup:null, lastResult:null, ending:null, events:[] });
}

export function seriesReadiness(state) {
  const station = state.episodes[2].choices.execution;
  const equipment = state.episodes[4].choices.execution;
  const f = state.facts;
  const route = station ? (['A','D'].includes(station) ? f.escort : f.routeSurvey) : false;
  const gear = equipment === 'A' ? f.fixedLight : equipment === 'B' ? f.mobileLight : ['C','D'].includes(equipment);
  const ready = route && f.signal && gear;
  return { route, signal:f.signal, equipment:gear, handover:f.handover,
    publicReady:ready, mobileReady:ready && ['B','C'].includes(equipment),
    equipmentKind:equipment ?? null, routeKind:station ?? null,
    signalKind:state.episodes[3].choices.execution ?? null,
    jungyeonAttends:f.jungyeonAttends };
}

function updatePreparation(state, stage, choice) {
  const id=state.episodeId, f=state.facts, c=state.episodes[id].choices;
  if (id===2) {
    if (stage==='inspection' && choice==='D') f.escort=true;
    if (stage==='deduction' && choice==='C' && ['A','C'].includes(c.inspection)) f.routeSurvey=true;
    if (stage==='time') f[choice==='A'?'routeSurvey':'escort']=true;
  }
  if (id===3) {
    if (stage==='inspection' && choice==='D') f.jungyeonAttends=true;
    if (stage==='deduction' && choice==='A' && ['B','C'].includes(c.inspection)) f.signal=true;
    if (stage==='time') f[choice==='A'?'jungyeonAttends':'signal']=true;
  }
  if (id===4) {
    if (stage==='inspection' && choice==='D') f.handover=true;
    if (stage==='deduction' && choice==='B') {
      if (['A','B'].includes(c.inspection)) f.fixedLight=true;
      if (['B','C'].includes(c.inspection)) f.mobileLight=true;
    }
    if (stage==='time' && choice==='A') { f.fixedLight=true; f.mobileLight=true; }
    if (stage==='time' && choice==='B') f.handover=true;
  }
  if (id===5 && stage==='repair') {
    if (choice==='A') f[['A','D'].includes(state.episodes[2].choices.execution)?'escort':'routeSurvey']=true;
    if (choice==='B') f.signal=true;
    const kind=state.episodes[4].choices.execution;
    if (choice==='C' && kind==='A') f.fixedLight=true;
    if (choice==='C' && kind==='B') f.mobileLight=true;
    if (choice==='D') f.handover=true;
  }
}

function finalOutcome(state, choice) {
  const plan=state.episodes[5].choices.plan, r=seriesReadiness(state);
  if (plan==='B' && !r.publicReady) return choice==='A'?'A':'D';
  if (plan==='C' && !r.mobileReady) return choice==='B'?'A':r.publicReady?'B':'D';
  return plan;
}

function actionsFor(state, choice, outcome) {
  const id=state.episodeId;
  if (id===2) return { A:['store-sign','guide-demonstration'], B:['assemble-signs','place-outward-sign','check-return-sign'], C:['draw-outward-map','fold-return-map','handoff-map'], D:['lock-sign-stand','turn-sign','rehearse-escort'] }[choice];
  if (id===3) return { A:['isolate-accompaniment','place-last-chair','rehearse-signal'], B:['form-circle','count-four-beats','rehearse-signal'], C:['prepare-number-cards','show-stop-card','rehearse-signal'], D:['private-listening','leave-recording','rehearse-signal'] }[choice];
  if (id===4) return { A:['match-fixed-supports','position-shade','handoff-equipment'], B:['match-carrier-supports','lower-carry-height','handoff-equipment'], C:['assemble-hand-signs','check-handles','handoff-equipment'], D:['set-daylight-schedule','store-lamp','handoff-equipment'] }[choice];
  const ownPlan=state.episodes[5].choices.plan===outcome;
  const middle={ A:ownPlan && choice==='B'?['confirm-arrivals','fold-together']:['welcome-arrival','fold-boats','welcome-again'],
    B:ownPlan && choice==='B'?['outward-walk','stop-relay','return-walk','teach-next-guide','second-outward-walk','second-return-walk']:['outward-walk','stop-relay','return-walk'],
    C:ownPlan && choice==='B'?['station-role','junction-role','shelter-role']:['station-welcome','junction-welcome','shelter-welcome'],
    D:ownPlan && choice==='A'?['short-outward-walk','short-return-walk','repeat-short-trial']:['short-outward-walk','short-return-walk','teach-next-guide'] }[outcome];
  return ['meet-yeonwoo',...middle,'confirm-every-person','collect-equipment','return-station','close-gathering'];
}

function followupFor(museum) {
  const f=museum.flags ?? {};
  return { boat:f.boat==='sealed'?'late-return-after-unsealing':f.boat==='damaged'?'returned-with-repair-marks':museum.sceneId==='E1'?'already-launched':'later-confirmed-return',
    record:f.record==='sealed'?'later-unsealed':f.record,
    originalNight:{boat:f.boat,record:f.record,moro:f.moro},
    moroCharged:true, sealPreserved:true, originalBoatAvailable:false };
}

export function dispatchSeries(state, event) {
  assert(state?.version===SERIES_VERSION, '지원하지 않는 연작 상태입니다.');
  assert(event && typeof event.type==='string', '이벤트가 필요합니다.');
  assert(event.revision===undefined || event.revision===state.revision, '이미 처리된 입력입니다.');
  assert(state.stage!=='complete', '이미 끝난 여정입니다.');
  const next=clone(state), ep=next.episodes[next.episodeId];
  let normalized;
  if (event.type==='explore') {
    assert(next.stage==='inspection' && ABCD.includes(event.target), '현재 조사할 대상이 아닙니다.');
    assert(!ep.explored.includes(event.target), '이미 조사한 대상입니다.');
    ep.explored.push(event.target); normalized={type:'explore',target:event.target};
  } else if (event.type==='choose') {
    const stage=next.stage, options=(stage==='time'||(next.episodeId===5 && stage==='execution'))?['A','B']:ABCD;
    assert(stages(next.episodeId).includes(stage) && options.includes(event.choice), '현재 선택할 행동이 아닙니다.');
    if (stage==='inspection') assert(ep.explored.includes(event.choice), '먼저 해당 현장 대상을 조사하세요.');
    const sceneId=SCENES[next.episodeId][stages(next.episodeId).indexOf(stage)];
    ep.choices[stage]=event.choice;
    next.lastResult={episodeId:next.episodeId,stage,sceneId,choice:event.choice};
    updatePreparation(next,stage,event.choice);
    if (stage==='execution') {
      const outcome=next.episodeId===5?finalOutcome(next,event.choice):event.choice;
      ep.outcome=outcome;
      ep.ending=ENDINGS[next.episodeId][ABCD.indexOf(outcome)];
      ep.requiredActions=actionsFor(next,event.choice,outcome);
      next.stage='perform';
    } else next.stage=stages(next.episodeId)[stages(next.episodeId).indexOf(stage)+1];
    normalized={type:'choose',choice:event.choice};
  } else if (event.type==='perform') {
    assert(next.stage==='perform', '지금 실행할 현장 행동이 없습니다.');
    assert(event.action===ep.requiredActions[ep.completedActions.length], '현재 순서의 현장 행동을 수행하세요.');
    ep.completedActions.push(event.action);
    if (ep.completedActions.length===ep.requiredActions.length) {
      next.visited.push(next.episodeId);
      next.stage=next.episodeId===5?'complete':'departure';
      if (next.stage==='complete') next.ending=ep.ending;
    }
    normalized={type:'perform',action:event.action};
  } else if (event.type==='depart') {
    assert(next.stage==='departure', '현장 실행과 인계를 먼저 마치세요.');
    next.episodeId=nextEpisodeFor(next);
    if (next.episodeId===5) {
      assert([2,3,4].every(id=>next.visited.includes(id)), '아직 방문하지 않은 장소가 있습니다.');
      next.followup=followupFor(next.museum);
    }
    next.stage='inspection'; normalized={type:'depart'};
  } else throw new Error('알 수 없는 연작 이벤트입니다.');
  next.revision++; next.events.push(normalized);
  return freeze(next);
}

export function getSeriesView(state) {
  const ep=state.episodes[state.episodeId], index=stages(state.episodeId).indexOf(state.stage);
  const choiceIds=index<0?[]:(state.stage==='time'||(state.episodeId===5 && state.stage==='execution'))?['A','B']:ABCD;
  const action=ep.requiredActions[ep.completedActions.length] ?? null;
  return freeze({ ...clone(state), title:TITLES[state.episodeId],
    sceneId:index>=0?SCENES[state.episodeId][index]:SCENES[state.episodeId][3],
    introSceneId:{2:'N20',3:'V30',4:'W40',5:'R50'}[state.episodeId],
    resultBranch:state.lastResult?.choice ?? null,
    options:choiceIds.map(id=>({id,available:state.stage!=='inspection'||ep.explored.includes(id)})),
    choices:clone(ep.choices), explored:[...ep.explored],
    requiredActions:[...ep.requiredActions], completedActions:[...ep.completedActions], nextAction:action,
    episodeEnding:ep.ending, readiness:seriesReadiness(state), nextEpisodeId:state.stage==='departure'?nextEpisodeFor(state):null,
    objective:state.stage==='inspection'?'현장의 단서를 살펴보고 조사 방향을 정하세요.':state.stage==='perform'?'선택한 방법을 현장에서 실행하세요.':state.stage==='departure'?'인계를 마쳤습니다. 다음 장소로 이동하세요.':state.stage==='complete'?'모든 사람의 귀환과 정리를 마쳤습니다.':'확인한 근거와 남은 준비를 보고 결정하세요.' });
}

export function saveSeries(state) {
  const payload={ version:SERIES_VERSION,museum:clone(state.museum),options:{moroAccompanies:state.moroAccompanies},events:clone(state.events) };
  return freeze({...payload,checksum:sha256(JSON.stringify(payload))});
}
export function restoreSeries(record) {
  assert(record?.version===SERIES_VERSION && Array.isArray(record.events) && record.events.length<=300, '잘못된 연작 저장 파일입니다.');
  const payload={version:record.version,museum:record.museum,options:record.options,events:record.events};
  assert(record.checksum===sha256(JSON.stringify(payload)), '연작 저장 내용이 변경됐습니다.');
  return record.events.reduce(dispatchSeries,createSeries(record.museum,record.options));
}
