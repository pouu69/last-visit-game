/** Authored field choreography. Completion projects objects, never grants preparation facts. */
export const WALK_FORMATION = Object.freeze({neighbor:-1.2,munjeong:-2.05});
export function actorRouteFor(action,actor,start) {
  const offset=WALK_FORMATION[actor];
  if(offset===undefined)return null;
  if(action.path) {
    const shifted=action.path.map(([x,z])=>[x+offset,z]);
    if(Math.hypot(start[0]-shifted[0][0],start[1]-shifted[0][1])<.001)return shifted;
    return [start,[offset,start[1]],...shifted];
  }
  if(action.motion==='greet' && actor==='neighbor')return [start,[offset,start[1]],[offset,action.z],[action.x+offset,action.z]];
  return null;
}
const object = (id, assetEpisode, assetId, x, z, y = 0) => ({ id, assetEpisode, assetId, x, y, z });
const OBJECTS = {
  2: [object('old-sign',2,'route-sign',3,-6),object('out-sign',2,'double-sign',6,-6),object('back-sign',2,'double-sign',7,-6),object('map',2,'folded-map',-3,-6,.95),object('support',2,'folding-support',3,-6)],
  3: [object('circle',3,'open-circle',0,0),object('last-chair',3,'chair',3,-5),object('cards',3,'signal-cards',-3,-5,.95),object('recording',3,'personal-player',6,5,.95),object('console',3,'track-console',-6,-6)],
  4: [object('lamp',4,'guide-lamp',-3,-6,.95),object('fixed',4,'fixed-stand',-1,-6),object('carrier',4,'carrying-base',2,-6),object('hands',4,'hand-signs',6,-6),object('notes',4,'inspection-documents',6,5,.95)],
  5: [object('shelter',5,'shelter',-3,-6),object('paper',5,'paper-stack',-3,-5,.95),object('basin',5,'water-basin',-5,-5),object('new-boat',1,'paper-boat',-5,-5,.27),object('fork',5,'river-path-fork',3,0),object('roles',5,'role-board',3,6,.95),object('cards',3,'signal-cards',5,0,.95),object('lamp',4,'guide-lamp',-5,-6),object('hands',4,'hand-signs',-6,-6)],
};
// Each action owns a place and terminal poses. Shared locations are intentional work areas.
const ACTIONS = {};
function action(id,label,x,z,effects={},motion='work',path=null) { ACTIONS[id]={id,target:id,label,x,z,effects,motion,path}; }
action('store-sign','옛 표지를 보관 선반으로 옮기기',3,-5,{'old-sign':{x:7,z:-7,rotation:Math.PI/2}} ,'carry');
action('guide-demonstration','보행로 입구에서 사람 안내 시범',-3,1,{},'gesture');
action('assemble-signs','화물실에서 두 방향 표지 조립',6,-5,{'out-sign':{visible:true},'back-sign':{visible:true}},'assemble');
action('place-outward-sign','출발 갈림점에 표지 세우기',-3,1,{'out-sign':{x:-4,z:0}},'carry');
action('check-return-sign','귀환 표지와 현장 확인 기록 대조',6,1,{},'turn');
action('draw-outward-map','작업대에서 출발 약도 그리기',-3,-5,{map:{visible:true}},'write');
action('fold-return-map','귀환면을 안으로 접기',-3,-5,{map:{part:'right',axis:'z',angle:Math.PI}},'fold');
action('handoff-map','문정에게 약도 인계',4,4,{map:{x:4,z:3,y:1}},'carry');
action('lock-sign-stand','접이식 받침 잠금 점검',3,-5,{support:{deployed:true}},'assemble');
action('turn-sign','표지를 돌려 귀환 방향 읽기',3,-5,{'old-sign':{rotation:Math.PI}},'turn');
action('rehearse-escort','선두와 후미 안내 시범',-3,1,{},'gesture');
action('isolate-accompaniment','음향실에서 허락받은 반주 분리',-6,-5,{console:{rotation:.15}},'write');
action('place-last-chair','빈 원 안으로 마지막 의자 옮기기',2,2,{'last-chair':{x:0,z:1.5,rotation:Math.PI}},'carry');
action('form-circle','서로 보이는 열린 원 만들기',0,2,{circle:{visible:true}},'assemble');
action('count-four-beats','원 안에서 네 박자 함께 세기',0,2,{},'beats');
action('prepare-number-cards','큰 숫자 카드 펼치기',-3,-4,{cards:{visible:true}},'assemble');
action('show-stop-card','글자가 보이도록 정지 카드 들기',-3,-4,{cards:{cardRaised:true}},'signal');
action('rehearse-signal','소희와 정지·재개 신호 시범',2,2,{},'signal');
action('private-listening','정연과 개인 기기로 듣기',6,4,{recording:{rotation:.2}},'listen');
action('leave-recording','개인 녹음을 극장 보관대에 남기기',6,4,{recording:{x:7,z:5}},'carry');
action('match-fixed-supports','고정 받침에 등 맞추기',-1,-5,{lamp:{x:-1,y:1.16,z:-6}},'assemble');
action('position-shade','그늘선을 보며 차광판 돌리기',-1,-5,{lamp:{part:'shade',axis:'y',angle:Math.PI/2}},'turn');
action('match-carrier-supports','전원을 끈 등과 운반대 맞추기',2,-5,{lamp:{x:2,y:.31,z:-6}},'assemble');
action('lower-carry-height','낮은 높이로 운반 시험',2,-4,{lamp:{x:2,y:.31,z:-3},carrier:{x:2,z:-3}},'carry');
action('assemble-hand-signs','주간용 손표지 조립',6,-5,{hands:{visible:true}},'assemble');
action('check-handles','출발·대기 표지 손잡이 확인',6,-5,{hands:{rotation:Math.PI/6}},'turn');
action('set-daylight-schedule','밝은 시간의 운영 일정 적기',6,4,{notes:{rotation:.2}},'write');
action('store-lamp','등과 점검 기록을 보관대로',-3,-5,{lamp:{x:-7,z:-7,y:1.1}},'carry');
action('handoff-equipment','검증 범위를 적어 담당자에게 인계',6,4,{notes:{x:5,z:4}},'write');
action('meet-yeonwoo','입구에서 연우 맞이하기',0,6,{},'greet');
action('confirm-arrivals','도착·불참 명단 대조',3,5,{roles:{rotation:.15}},'write');
action('fold-together','쉼터에서 함께 새 종이 펴기',-3,-4,{paper:{rotation:.3},'new-boat':{visible:true}},'fold');
action('welcome-arrival','쉼터 입구에서 도착한 사람 맞기',0,-3,{},'greet');
action('fold-boats','쉼터에서 새 종이배 접기',-3,-4,{paper:{folded:true},'new-boat':{visible:true}},'fold');
action('welcome-again','쉼터 입구에서 늦게 온 사람 맞기',0,-3,{},'greet');
action('outward-walk','역 뒤뜰에서 쉼터까지 함께 걷기',0,6,{},'walk',[[0,6],[0,1],[0,-4]]);
action('stop-relay','갈림점에서 정지 신호 되돌려 확인',3,1,{cards:{cardRaised:true}},'signal');
action('return-walk','쉼터에서 역 뒤뜰로 돌아오기',0,-4,{},'walk',[[0,-4],[0,1],[0,6]]);
action('teach-next-guide','다음 안내자와 역할 직접 연습',3,5,{roles:{rotation:-.15}},'gesture');
action('second-outward-walk','다음 안내자와 두 번째 출발',0,6,{},'walk',[[0,6],[0,1],[0,-4]]);
action('second-return-walk','두 번째 대열과 귀환 확인',0,-4,{},'walk',[[0,-4],[0,1],[0,6]]);
for(const [place,x,z] of [['station',0,6],['junction',3,1],['shelter',0,-4]]) {
  const name={station:'역 뒤뜰',junction:'갈림점',shelter:'쉼터'}[place];
  action(`${place}-role`,`${name} 담당자와 역할 실행`,x,z,{},place==='junction'?'signal':'greet');
  action(`${place}-welcome`,`${name}에서 합류 인원 확인`,x,z,{},'greet');
}
action('short-outward-walk','쉼터에서 가까운 갈림점까지만 걷기',0,-4,{},'walk',[[0,-4],[0,-1],[2,-1]]);
action('short-return-walk','담당자와 쉼터로 돌아오기',2,-1,{},'walk',[[2,-1],[0,-1],[0,-4]]);
action('repeat-short-trial','같은 짧은 구간을 한 번 더 왕복',0,-4,{},'walk',[[0,-4],[0,-1],[2,-1],[0,-1],[0,-4]]);
action('confirm-every-person','쉼터에서 마지막 사람에게 종료 확인',0,-4,{},'greet');
action('collect-equipment','표지·카드와 물품 수거',-3,-4,{cards:{x:3,z:6,visible:false},lamp:{x:3,z:6,visible:false},hands:{x:3,z:6,visible:false},paper:{x:3,z:6,visible:false}},'carry');
action('return-station','모두 함께 역 뒤뜰로 귀환',0,-4,{},'walk',[[0,-4],[0,1],[0,6]]);
action('close-gathering','역 뒤뜰에서 귀환 명단을 닫기',3,5,{roles:{rotation:0}},'write');

export function actionPlanFor(state) {
  const ep=state.episodes[state.episodeId], facts=state.facts;
  const actions=ep.requiredActions.map(id=>{if(!ACTIONS[id]) throw new Error(`Missing field action: ${id}`);return structuredClone(ACTIONS[id]);});
  if(state.episodeId===4) {
    for(const a of actions) {
      if(a.id==='lower-carry-height' && !facts.mobileLight) {a.label='운반 시험 대기 · 견본 높이를 종이에 표시';a.effects={notes:{rotation:.25}};a.motion='write';a.x=6;a.z=4;}
      if(a.id==='position-shade' && !facts.fixedLight) {a.label='고정 설치 시험 대기 · 차광 위치 기록';a.effects={notes:{rotation:.25}};a.motion='write';a.x=6;a.z=4;}
      if(a.id==='handoff-equipment' && !facts.handover) a.label='독립 인수 미완료 · 태오의 보관 책임 기록';
    }
  }
  const objects=structuredClone(OBJECTS[state.episodeId]);
  const projection=Object.fromEntries(objects.map(o=>[o.id,{x:o.x,y:o.y,z:o.z,rotation:0,visible:!['out-sign','back-sign','map','circle','cards','hands','new-boat'].includes(o.id)}]));
  for(const id of ep.completedActions) {
    for(const [key,patch] of Object.entries(actions.find(a=>a.id===id).effects)) Object.assign(projection[key],patch);
    if(id==='check-return-sign') Object.assign(projection['back-sign'],facts.routeSurvey?{x:6,z:0,rotation:Math.PI}:{x:7,z:-6,rotation:Math.PI/2});
  }
  if(state.episodeId===5) {
    const kind=state.episodes[4].choices.execution;
    const collected=ep.completedActions.includes('collect-equipment');
    projection.lamp.visible=!collected && ((kind==='A'&&facts.fixedLight)||(kind==='B'&&facts.mobileLight));
    projection.hands.visible=!collected&&kind==='C';
    projection.cards.visible=!collected&&state.episodes[3].choices.execution==='C';
  }
  const npcProjection={};
  if(state.episodeId===5) {
    for(const id of ep.completedActions) {
      const a=ACTIONS[id];
      if(a.path) {
        const [x,z]=a.path.at(-1);for(const [actor,offset] of Object.entries(WALK_FORMATION)) npcProjection[actor]={x:x+offset,z};
      } else if(a.motion==='greet') npcProjection.neighbor={x:a.x+WALK_FORMATION.neighbor,z:a.z};
    }
  }
  const nextAction=state.stage==='perform'?actions[ep.completedActions.length]??null:null;
  return {actions,nextAction,objects,projection,npcProjection,hotspots:actions.map(({id,label,x,z})=>({id,label,x,z})),
    participants:{escort:facts.escort,signal:facts.signal,jungyeon:facts.jungyeonAttends,handover:facts.handover},
    completed:[...ep.completedActions]};
}
