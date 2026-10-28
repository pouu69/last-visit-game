/** Source-backed narrative adapter. Build must copy docs/series/*.md to dist/docs/series/. */
import {seriesReadiness,nextEpisodeFor} from './series-state.mjs';
const FILES={1:'episode-01-bridge.md',2:'episode-02-station.md',3:'episode-03-theatre.md',4:'episode-04-workshop.md',5:'episode-05-river.md'};
const SCENES={2:['N20','N21','N22','N23','N24','N25'],3:['V30','V31','V32','V33','V34','V35'],4:['W40','W41','W42','W43','W44','W45'],5:['R50','R51','R52','R53']};
const stages=id=>id===5?['inspection','plan','repair','execution']:['inspection','deduction','time','execution'];
function section(text,prefix,level=2) {
 const lines=text.split('\n'), start=lines.findIndex(line=>line.startsWith(`${'#'.repeat(level)} ${prefix}`));
 if(start<0)return '';
 let end=start+1;while(end<lines.length && !new RegExp(`^#{1,${level}} `).test(lines[end]))end++;
 return lines.slice(start+1,end).join('\n');
}
const preamble=text=>text.split(/^### /m)[0];
const clean=text=>text.replace(/\*\*/g,'').replace(/`/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').trim();
const message=(text,speaker='서술')=>({speaker,text});
function allowed(label,state) {
 const f=state.facts??{},ep=state.episodes?.[state.episodeId], ready=state.episodeId===4?(ep?.choices.execution==='B'?f.mobileLight:f.fixedLight):false;
 if(label.includes('모로 비동행'))return !state.moroAccompanies;
 if(label.includes('모로'))return state.moroAccompanies;
 if(label.includes('V31-D 미선택'))return !f.jungyeonAttends;
 if(label.includes('V31-D 선택'))return state.episodes[3].choices.inspection==='D';
 if(label.includes('참석 의향 확인'))return f.jungyeonAttends;
 if(label.includes('참석 보류'))return !f.jungyeonAttends;
 if(label.includes('동행 확약 때')||label.includes('확약 때'))return f.escort;
 if(label.includes('확약 없음'))return !f.escort;
 if(label.includes('시험 대기일 때'))return !f.routeSurvey;
 if(label.includes('완료일 때'))return f.routeSurvey;
 if(label.includes('준비 완료'))return ready;
 if(label.includes('시험 대기'))return !ready;
 return true;
}
const META=/^(획득|준비|결과|다음|인계|갱신|집필 메모|힌트|진행|집필용 기록|편의 질문|v2|조건|해석의 변화)/;
function paragraphs(text,state) {
 const result=[];
 for(const raw of text.split('\n')) {
  let line=raw.trim();
  if(!line || /^#|^\||^[-*] |^\d+\./.test(line))continue;
  const match=line.match(/^\*\*([^*]+):?\*\*\s*(.*)$/);
  if(match) {
   const label=match[1].replace(/:$/,'').trim();
   if(META.test(label)||!allowed(label,state))continue;
   if(label==='인수 완료') { result.push(message(state.facts.handover?'이든이 다음 점검을 받는다.':'태오의 보관·점검 책임을 유지하고 다음번도 교육과 함께 진행한다.')); continue; }
   const speaker=label.includes('서술')?'서술':label.endsWith('/ 모로')?'모로':label.split(' /')[0];
   if(label==='실행' && state.lastResult?.stage==='execution' && state.episodeId<5) { result.push(message(executionNarration(state))); continue; }
   if(['실행','선택 전 확인','선택 전 안내','얻는 것','남는 일','확인한 조건'].includes(speaker)) {
    if(speaker==='확인한 조건')continue;
    result.push(message(clean(match[2]),speaker==='실행'?'서술':'안내'));continue;
   }
   let value=clean(match[2]);
   if(!state.moroAccompanies && speaker==='팀' && value==='오늘은 여기까지예요. 인계한 곳으로 같이 돌아가 충전하죠.')continue;
   value=resolveCurrentNarration(value,state);
   if(state.episodeId===3 && state.lastResult?.sceneId==='V34' && state.lastResult.choice==='B' && state.facts.jungyeonAttends && value.startsWith('모임 참석은 오늘 정하지'))value='참석 약속은 아까 한 그대로예요. 저는 안쪽에서 자료를 정리할 테니 끝나면 불러 주세요.';
   result.push(message(value,speaker));
  } else if(!/^(진행:|집필용|선택한 |신호 방식|태오의 수리소|2·3·4편|부족한 항목|각 항목|기본 도착|방향을 골라도|기존 엔딩|읽을 수 없게|바꾼 방향|다음 편|기존 사건|먼저 \[|각 엔딩|그 한 달|모든)/.test(line)) {
   if(!/^기록:|^집필|원고|준비 판정/.test(line)) result.push(message(clean(line)));
  }
 }
 return result.filter(m=>m.text);
}
function resolveCurrentNarration(value,state) {
 if(state.episodeId!==5)return value;
 const ep=state.episodes[5],f=state.facts;
 value=value.replace('정연이 불참했다면 나래와 한다.',f.jungyeonAttends?'정연과 함께 의자를 옮긴다.':'나래와 함께 의자를 옮긴다.');
 value=value.replace('여러분은 R51에서 맡은 일을 실행한다. 도착 안내를 맡았다면 그 위치에서 만나고, 다른 일을 맡았다면 문정이 입구에 다녀오는 동안 그 역할을 지킨다.', {
  A:'여러분이 안내 위치로 가서 연우를 맞는다.',
  B:'문정이 입구에서 연우를 맞는 동안 여러분은 의자와 통로를 정리한다.',
  C:'문정이 입구에서 연우를 맞는 동안 여러분은 보조 신호 위치를 지킨다.',
  D:'문정이 입구에서 연우를 맞는 동안 여러분은 귀환과 물품 인계 담당을 확인한다.',
 }[ep.choices.inspection]??'여러분이 맡은 현장 역할을 지킨다.');
 const ownPlan=ep.choices.plan===ep.outcome;
 value=value.replace('A의 반복 시작 또는 B의 공동 집결 방식이 남는다.',ownPlan&&ep.choices.execution==='B'?'도착과 불참을 확인한 뒤 함께 시작한 방식이 남는다.':'새로 도착한 사람을 맞아 다시 시작한 방식이 남는다.');
 value=value.replace('A는 한 대열의 경험, B는 다음 안내자를 곁에서 익힌 경험이 남는다.',ownPlan&&ep.choices.execution==='B'?'두 차례 왕복하며 다음 안내자를 곁에서 가르친 경험이 남는다.':'한 대열이 출발하고 돌아온 경험이 남는다.');
 value=value.replace('A는 반복 형식이, B는 장소별 역할이 남는다.',ep.choices.execution==='B'?'장소마다 길 안내, 신호, 종이 전달을 나눈 역할이 남는다.':'세 접점에서 같은 인사와 신호로 맞은 방식이 남는다.');
 value=value.replace('점검 인수가 완료됐다면 이든이 장비를 받고, 아니라면 태오가 보관하며 이든은 교육 동행으로 적힌다.',f.handover?'이든이 장비를 받고 다음 점검을 맡는다.':'태오가 장비를 보관하고 이든은 교육 동행으로 적힌다.');
 value=value.replace('출고한 조명은 이든에게, 시험 대기 견본은 수리소로 돌아간다. 인수하지 않은 점검을 이든에게 떠넘기지 않는다.',f.handover?'출고한 조명은 점검을 인수한 이든에게, 시험 대기 견본은 수리소로 돌아간다.':'조명과 시험 대기 견본은 태오가 맡은 수리소로 돌아간다. 이든의 다음 점검 교육은 남아 있다.');
 return value;
}
function executionNarration(state) {
 const id=state.episodeId,c=state.episodes[id].choices.execution,f=state.facts;
 if(id===2) {
  const ready=['A','D'].includes(c)?f.escort:f.routeSurvey;
  return {A:ready?'옛 표지를 보관하고 문정과 첫날 선두·후미 역할을 확정한다.':'옛 표지를 보관하고 안내 시범을 한다. 첫날 안내조는 아직 미정이다.',
   B:ready?'확인한 두 갈림점에 출발·귀환 표지를 준비한다.':'출발 표지를 준비하고 귀환 표지에는 설치 시험 대기 표시를 붙인다.',
   C:ready?'갈 때와 올 때를 나눈 독립 안내용 약도를 접어 전달한다.':'안내자와 함께 볼 약도를 접는다. 개인 출발용으로 배포하지 않는다.',
   D:ready?'이동 표지의 잠금을 확인하고 문정과 선두·후미를 나눠 시범한다.':'이동 표지를 돌려 시범한다. 첫날 후미 역할은 빈칸으로 남긴다.'}[c];
 }
 if(id===3) {
  const action={A:'독창이 섞이지 않은 허용 반주와 배경음만 분리해 전달한다.',B:'새 공동 박자를 작은 원에서 연습한다.',C:'숫자·문자와 손모양이 함께 있는 카드를 준비한다.',D:'정연의 기기로 개인 청취를 마친다. 음원은 가져가지 않고 손·말 신호만 가져간다.'}[c];
  return action+(f.signal?' 공개 대열에서 신호를 되돌려 확인한 기록을 함께 남긴다.':' 현재 사람끼리의 시범이며 공개 대열 신호 시험은 아직 남아 있다.');
 }
 const ready=c==='A'?f.fixedLight:f.mobileLight;
 if(c==='A'||c==='B')return ready?`점검한 ${c==='A'?'고정등':'이동등'} 한 대를 인계한다. 다음 점검 인수는 별도 기록을 따른다.`:'견본은 수리소에 남긴다. 선택한 형태의 사용 전 시험 메모만 가져간다.';
 return c==='C'?'주간용 손표지와 받침을 전달한다. 전기 조명은 가져가지 않는다.':f.handover?'주간 운영 시간을 정하고 점검 노트를 이든에게 인계한다. 등은 수리소에 남긴다.':'주간 운영 시간을 정한다. 태오가 등과 노트를 보관하며 다음 회차 교육은 남겨 둔다.';
}
function choiceSection(source,id) {return section(source,`${id} —`,3);}
function beforeEnding(source) {return source.split(/^#### /m)[0];}
// Reasons follow theme-and-routes.md §6; fallback requests keep the remaining
// location's task rather than sending the player back to a completed episode.
const NEXT_PLACES={2:'종착역',3:'작은 극장',4:'수리소',5:'역 뒤뜰과 강변 쉼터'};
const ROUTE_REASONS={
  2:{A:'모일 사람에게 출발 신호를 보낼 차례다.',B:'표지와 안내에 필요한 현장 장비를 정할 차례다.',C:'표지와 안내에 필요한 현장 장비를 정할 차례다.',D:'모일 사람에게 출발 신호를 보낼 차례다.'},
  3:{A:'새 신호를 현장에서 다룰 장비를 준비해야 한다.',B:'새 신호를 현장에서 다룰 장비를 준비해야 한다.',C:'시각 안내에 맞는 동선을 확인해야 한다.',D:'개인 전달에 맞는 동선을 확인해야 한다.'},
  4:{A:'준비한 조건에 맞는 길과 집결점을 확인해야 한다.',B:'이동 중 사람이 맞출 신호를 함께 정해야 한다.',C:'이동 중 사람이 맞출 신호를 함께 정해야 한다.',D:'준비한 조건에 맞는 길과 집결점을 확인해야 한다.'},
};
const REMAINING_REQUESTS={2:'길 표지판과 사람들이 도착할 동선을 확인한다.',3:'옛 녹음의 사용 범위와 모임의 시작·정지 신호를 확인한다.',4:'강변 안내등과 현장에서 쓸 장비를 확인한다.'};
const routeRequest=m=>/극장.*(주세요|맞추세요)|수리소.*주세요|역에서 정할|밝은 시간에 길을 먼저 확인/.test(m.text);
function departureBridge(state,ending,sources) {
 const next=nextEpisodeFor(state);
 // With no completed places excluded, the same resolver gives the preference.
 const preferred=nextEpisodeFor({...state,visited:[]}), replaced=next!==preferred;
 const messages=ending.filter(m=>!replaced||!routeRequest(m));
 if(replaced)messages.push(message('그곳에서 받은 결과는 여기 적어 뒀어요. 같은 일을 다시 부탁할 필요는 없겠네요. 아직 만나지 못한 쪽에 연락해 볼게요.','나래의 메시지'),message('여러분은 앞서 마친 곳의 기록을 접고, 남은 부탁이 적힌 안내지를 펼친다.'));
 if(next===5) {
  messages.push(...paragraphs(preamble(section(sources[5],'R50')),state).filter(m=>m.speaker==='나래의 메시지'));
 } else messages.push(message(`다음 목적지는 ${NEXT_PLACES[next]}이다. ${replaced?REMAINING_REQUESTS[next]:ROUTE_REASONS[state.episodeId][state.episodes[state.episodeId].choices.execution]}`));
 return messages;
}
function knowledgeIntro(state) {
 const known=state.visited, messages=[];
 if(state.episodeId===2) {
  if(known.includes(3)) messages.push(message('정연 씨가 기다리던 자리를 지도에 먼저 표시해 봅시다. 준비한 신호를 볼 수 있는 곳도 확인해야겠네요.','문정'));
  if(known.includes(4)) messages.push(message('가져올 장비와 운영 시간에 맞춰 통로 밖에 안내를 둘 자리를 살펴보겠습니다.','문정'));
 }
 if(state.episodeId===3) {
  if(known.includes(2))messages.push(message('역에서 정한 안내 방식에 맞춰, 서 있는 사람과 걷는 사람에게 어떻게 신호를 보낼지 확인하죠.','소희'));
  if(known.includes(4))messages.push(message('수리소의 지속 조명과 시작·정지 신호는 별도로 준비하죠.','소희'));
 }
 if(state.episodeId===4) {
  if(known.includes(2))messages.push(message('역에서 고른 안내 방식에 맞춰 받침과 손의 여유를 확인해 볼게요.','태오'));
  if(known.includes(3))messages.push(message('정연 씨가 본 켜진 등은 종료 안내가 전해졌다는 뜻이 아니었군요. 길을 비추는 일과 신호를 구분하겠습니다.','태오'));
 }
 return messages;
}
function actualPreparation(state) {
 const r=seriesReadiness(state), labels={route:'길',signal:'공개 신호',equipment:'선택 장비',handover:'다음 점검 인수'};
 return message(Object.entries(labels).map(([k,v])=>`${v}: ${r[k]?'완료':'미완료'}`).join(' · '),'준비 확인');
}
function finalSection(sources,state) {return section(sources[5],`R54-${state.episodes[5].choices.plan}`);}
function finalChoices(state) {
 const plan=state.episodes[5].choices.plan,r=seriesReadiness(state);
 if(plan==='B'&&!r.publicReady)return [{id:'A',label:'한자리 모임으로 바꾼다'},{id:'B',label:'담당자와 작은 동행 시험을 한다'}];
 if(plan==='C'&&!r.mobileReady)return [{id:'A',label:r.publicReady?'이동 접점을 줄여 한 대열로 왕복한다':'담당자와 작은 시험으로 바꾼다'},{id:'B',label:'한자리 모임으로 바꾼다'}];
 return null;
}

export async function loadSeriesContent({readFile}={}) {
 if(!readFile) {
  if(typeof window==='undefined') {const fs=await import('node:fs/promises');readFile=name=>fs.readFile(new URL(`../docs/series/${name}`,import.meta.url),'utf8');}
  else readFile=async name=>{const response=await fetch(new URL(`../docs/series/${name}`,import.meta.url));if(!response.ok)throw new Error(`스토리 원고를 읽지 못했습니다: ${name}`);return response.text();};
 }
 const sources=Object.fromEntries(await Promise.all(Object.entries(FILES).map(async([id,name])=>[id,await readFile(name)])));
 function currentSection(state) {
  const index=stages(state.episodeId).indexOf(state.stage);
  if(state.episodeId===5) return state.stage==='execution'?finalSection(sources,state):section(sources[5],SCENES[5][index+1]);
  return section(sources[state.episodeId],SCENES[state.episodeId][[1,3,4,5][index]??5]);
 }
 return {
  inspection(state,id) {
   if(!['A','B','C','D'].includes(id))return [];
   const block=section(sources[state.episodeId],SCENES[state.episodeId][1]);
   return paragraphs(choiceSection(block,id),state);
  },
  intro(state) {
   let text=preamble(section(sources[state.episodeId],SCENES[state.episodeId][0]));
   if(state.episodeId===5) text=text.replace(/\*\*4-A\/B가 시험 대기일 때만 \/ 서술:\*\*[^\n]+/g,match=>['A','B'].includes(state.episodes[4].choices.execution)&&!seriesReadiness(state).equipment?match.replace('4-A/B가 시험 대기일 때만 / ',''):'');
   const messages=paragraphs(text,state);
   if(state.episodeId===5) {
    messages.push(message(state.facts.jungyeonAttends?'정연이 의자를 가져온다. “이번에는 노래 맡은 사람이 아니라 여기 앉는 사람으로 왔어요.”':'정연에게서 “오늘은 가지 않을게요”라는 메시지가 온다. 나래는 다른 참석자의 자리를 둔다.'));
    messages.push(message('오늘은 새 종이로 배를 접는다. 지난 모임의 원래 배와 뒤에 마친 반환은 당시의 기록대로 남긴다.'));
    messages.push(actualPreparation(state));
   }
   return [...messages,...knowledgeIntro(state)];
  },
  stage(state) {
   if(!stages(state.episodeId).includes(state.stage))return [];
   let text=preamble(currentSection(state));
   const messages=paragraphs(text,state);
   // Lists are evidence, not production notes. Preserve numbered puzzle data.
   for(const line of text.split('\n'))if(/^\d+\. /.test(line))messages.push(message(clean(line),'확인한 조건'));
   if(state.episodeId===5 && ['plan','repair','execution'].includes(state.stage))messages.push(actualPreparation(state));
   return messages;
  },
  choices(state) {
   if(!stages(state.episodeId).includes(state.stage))return [];
   if(state.episodeId===5 && state.stage==='execution') {const fallback=finalChoices(state);if(fallback)return fallback;}
   return [...currentSection(state).matchAll(/^### ([A-D]) — (.+)$/gm)].map(match=>({id:match[1],label:clean(match[2])}));
  },
  result(state) {
   const r=state.lastResult;if(!r)return [];
   if(r.episodeId===5 && r.stage==='execution') {
    const own=state.episodes[5].outcome===state.episodes[5].choices.plan;
    if(!own)return [message(`현재 준비로 실제 수행할 범위를 ‘${state.episodes[5].ending}’에 맞춰 정했다. 선택하지 않은 장비와 추가 보완은 얻지 않는다.`)];
    return paragraphs(beforeEnding(choiceSection(finalSection(sources,state),r.choice)),state);
   }
   const block=section(sources[r.episodeId],r.sceneId);
   let selected=choiceSection(block,r.choice);
   if(r.stage==='execution')selected=beforeEnding(selected);
   const messages=paragraphs(selected,state);
   if(r.stage==='inspection'&&r.episodeId<5)messages.push(...paragraphs(section(sources[r.episodeId],SCENES[r.episodeId][2]),state));
   return messages;
  },
  ending(state) {
   const ep=state.episodes[state.episodeId];if(!ep.ending)return [];
   if(state.episodeId===5) {
    const block=section(sources[5],`R54-${ep.outcome}`);
    const end=section(block,`최종 엔딩`,4);
    return [...paragraphs(end,state),...paragraphs(section(sources[5],'마지막 장면'),state)];
   }
   const block=choiceSection(section(sources[state.episodeId],SCENES[state.episodeId][5]),ep.choices.execution);
   const ending=paragraphs(block.slice(block.indexOf('#### ')).replace('극장을 나올 때','개인 청취를 마친 뒤'),state);
   return departureBridge(state,ending,sources);
  },
  bridge(museumView,moroAccompanies=false) {
   const state={museum:museumView,moroAccompanies,episodeId:1,facts:{},episodes:{},visited:[1]};
   const invitation=section(sources[1],`${museumView.sceneId} 뒤`,3);
   const common=preamble(section(sources[1],'3. 공통 연결'));
   return [...paragraphs(invitation,state),...paragraphs(common,state),message(moroAccompanies?'인계 담당자와 확인하고 필요한 충전을 마친 뒤 모로와 함께 출발한다. 접속부 봉인은 유지한다.':'모로는 인계 장소에서 충전과 후속 처리를 받는다. 방문객들은 다음 장소로 출발한다.')];
  },
  followup(state) {
   const root=section(sources[1],'5. 준비 기간');
   const flags=state.museum.flags??{};
   const heading=state.museum.sceneId==='E1'?'배가 E1에서':flags.boat==='sealed'?'배가 밀봉':flags.boat==='damaged'?'배가 손상':'온전하지만';
   const messages=paragraphs(section(root,heading,3),state);
   messages.push(message(flags.record==='sealed'?'사흘 뒤 별도 함을 개봉해 장부를 인계했다. 당일에 시정 근거를 확보했던 것으로 바꾸지는 않는다.':flags.record==='unreadable'?'번진 원본 장부는 그대로다. 남은 사본·서명·로그만 시정 확인에 사용한다.':'보존한 원본 장부의 장소와 관리자를 확인했다.'));
   return messages;
  },
 };
}
