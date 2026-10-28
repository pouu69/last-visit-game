import { createSeries, dispatchSeries, getSeriesView, saveSeries, restoreSeries } from '../src/series-state.mjs';
import { loadSeriesContent } from '../src/series-content.mjs';
import { mountSeriesWorld } from './series-world.mjs';
import { createSeriesTransition } from './series-transition.mjs';
import { gameAudio } from './audio.mjs';
import { actionPlanFor } from './series-action-plan.mjs';

const PREFIX = 'return-path-series-v2:';
const MODELS = { 2:['stroller','route-sign','return-crate','munjeong'], 3:['track-console','score-notes','signal-cards','jeongyeon'], 4:['guide-lamp','fixed-stand','carrying-base','ideun'], 5:['role-board','chair','signal-cards','narae'] };
const LABELS = { 2:['정문과 보행로','표지판 받침','반송 화물','문정'], 3:['녹음 파형','수정한 악보','무대 신호','정연'], 4:['차광판','서로 다른 받침','운반 높이','이든의 인수 노트'], 5:['도착 안내','참석자의 자리','신호 전달 위치','귀환과 인수'] };
const COORDS = [[-5,-3],[5,-3],[-5,3],[5,3]];
const element = (tag, text, className) => { const n=document.createElement(tag); if(text)n.textContent=text; if(className)n.className=className; return n; };

export async function mountSeriesGame({ museumView, sessionId, storage, onClose }) {
  const content = await loadSeriesContent();
  let state, world, transition, warning = '', closed = false, dialogOpen = false;
  let performing = false, importing = false, generation = 0, dialogGeneration = 0;
  let lastTransitionPhase = 'idle', pendingStart = null, arrivalQueued = false;
  let presentation = { seen: [], cursor: 0 };
  const key = PREFIX + sessionId;
  function readRecord(record) {
    const restored = restoreSeries(record);
    const ui = record.presentation;
    return { state: restored, presentation: {
      seen: Array.isArray(ui?.seen) ? ui.seen.filter(x => [2,3,4,5].includes(x)) : (restored.revision ? [restored.episodeId] : []),
      cursor: Number.isSafeInteger(ui?.cursor) && ui.cursor >= 0 ? ui.cursor : 0,
    } };
  }
  try {
    const saved = storage?.getItem(key);
    if (saved) { const record = readRecord(JSON.parse(saved)); state = record.state; presentation = record.presentation; }
  } catch { warning = '자동 저장 기록을 읽을 수 없습니다. 정상 기록을 불러오거나 새 여정을 시작하세요.'; }
  const root = element('section', null, 'series-game'); root.setAttribute('aria-label', '돌아가는 길');
  const stage = element('div', null, 'series-stage'), hud = element('header', null, 'series-hud');
  const title = element('h1'), objective = element('p');
  const menu = element('div', null, 'series-menu'), panel = element('section', null, 'series-panel');
  panel.setAttribute('aria-label', '대화와 선택');
  const overlay = element('div', null, 'series-cover'), coverTitle = element('p');
  overlay.append(coverTitle); overlay.hidden = true;
  hud.append(title, objective); root.append(stage, hud, menu, panel, overlay); document.body.append(root);
  const visible = () => !closed && !document.hidden;
  const button = (label, fn, parent = panel) => {
    const b = element('button', label); b.type = 'button';
    b.onclick = () => { if (visible()) fn(); }; parent.append(b); return b;
  };
  function recordFor(next = state, ui = presentation) { return { ...saveSeries(next), presentation: ui }; }
  function persist(next = state) {
    if (closed) return;
    state = next;
    try { if (!storage) throw Error(); storage.setItem(key, JSON.stringify(recordFor())); }
    catch { warning = '자동 저장을 사용할 수 없습니다. 기록을 내려받아 보관하세요.'; }
  }
  function locked() { return !visible() || !state || dialogOpen || performing || importing || transition?.status !== 'idle'; }
  function setDialog(value) { dialogOpen = value; panel.hidden = !value; gameAudio.setDialogue?.(value && visible()); world?.update({ locked: locked() }); }
  function definitions(ep) {
    return ['A','B','C','D'].map((id,i) => ({ id, label:LABELS[ep][i], x:COORDS[i][0], z:COORDS[i][1], assetId:MODELS[ep][i], assetEpisode:ep===5&&[1,2].includes(i)?3:ep, kind:i===3?'npc':'prop' }))
      .concat([{ id:'consult', label:'확인한 근거로 의논하기', x:0,z:-3,assetId:{2:'munjeong',3:'sohui',4:'taeo',5:'narae'}[ep],kind:'npc' }]);
  }
  function project(next) {
    world.setEpisode({ episodeId:next.episodeId, hotspots:definitions(next.episodeId), moroAccompanies:next.moroAccompanies });
    world.applyStory(next);
  }
  function setup() { project(state); gameAudio.setScene?.(state.episodeId); refresh(); }
  function refresh() {
    if (!state || closed) return;
    const v = getSeriesView(state), plan = actionPlanFor(state);
    title.textContent = `${v.episodeId}편 · ${v.title}`;
    const next = plan.nextAction;
    objective.textContent = (performing ? `${next?.label ?? '현장 행동'} · 실행 중` : v.stage === 'perform' && next ? `${next.label} · 표시된 장소에서 E` : v.stage === 'departure' ? `${{2:'종착역',3:'작은 극장',4:'수리소',5:'역 뒤뜰과 강변 쉼터'}[v.nextEpisodeId]}로 이동 · 출구에서 E` : v.objective) + (warning ? ' · '+warning : '');
    if (!performing) world.applyStory(state);
    const active = v.stage === 'inspection' ? ['A','B','C','D','consult'] : v.stage === 'perform' ? (next ? [next.target] : []) : v.stage === 'departure' ? ['__exit'] : v.stage === 'complete' ? [] : ['consult'];
    world.update({ locked:locked(), completedIds:v.explored, activeIds:active });
    importButton.disabled = importing || performing || transition.status !== 'idle';
  }
  function messages(items, done, { arrival = false } = {}) {
    if (closed) return;
    const token = ++dialogGeneration;
    const list = Array.isArray(items) ? items : [];
    let index = arrival ? Math.min(presentation.cursor, list.length) : 0;
    setDialog(true);
    function finish() {
      if (closed || token !== dialogGeneration) return;
      if (arrival) { presentation = { seen:[...new Set([...presentation.seen,state.episodeId])], cursor:0 }; persist(); }
      setDialog(false); done?.(); refresh();
      if (!dialogOpen) stage.querySelector('canvas')?.focus();
    }
    function draw() {
      if (closed || token !== dialogGeneration) return;
      panel.replaceChildren(); const m = list[index];
      if (!m) { finish(); return; }
      panel.append(element('strong',m.speaker),element('p',m.text));
      button(index < list.length-1 ? '계속' : '현장으로', () => {
        if (token !== dialogGeneration) return;
        index++; if (arrival) { presentation.cursor = index; persist(); }
        if (index < list.length) draw(); else finish();
      });
      panel.querySelector('button')?.focus({ preventScroll:true });
    }
    draw();
  }
  function arrival() {
    if (!visible()) { arrivalQueued = true; return; }
    arrivalQueued = false;
    if (presentation.seen.includes(state.episodeId)) { refresh(); return; }
    messages([...(state.episodeId === 5 ? content.followup(state) : []), ...content.intro(state)], undefined, { arrival:true });
  }
  function choices() {
    if (!visible() || importing || performing) return;
    const v = getSeriesView(state), token = ++dialogGeneration;
    setDialog(true); panel.replaceChildren();
    panel.append(element('h2',v.stage==='inspection'?'이번 조사에서 가져갈 근거':'다음 행동'));
    const labels = content.choices(state);
    for (const option of v.options) {
      const label = Array.isArray(labels) ? labels.find(x=>x.id===option.id)?.label : labels?.[option.id];
      const b = button(label ?? option.id, () => {
        if (token !== dialogGeneration || importing) return;
        try {
          persist(dispatchSeries(state,{type:'choose',choice:option.id,revision:state.revision}));
          gameAudio.play('confirm');
          if (state.stage === 'perform') { ++dialogGeneration; setDialog(false); refresh(); }
          else messages(content.result(state));
        } catch (e) { panel.append(element('p',e.message)); }
      }); b.disabled = !option.available;
    }
    button('현장을 더 살펴보기', () => { if(token!==dialogGeneration)return; ++dialogGeneration; setDialog(false); refresh(); });
  }
  function interact(id) {
    if (locked()) return;
    const v = getSeriesView(state);
    try {
      if (v.stage === 'inspection' && ['A','B','C','D'].includes(id)) {
        gameAudio.play('inspect');
        if (!v.explored.includes(id)) persist(dispatchSeries(state,{type:'explore',target:id}));
        messages(content.inspection(state,id), choices);
      } else if (v.stage === 'perform') {
        const action = actionPlanFor(state).nextAction;
        if (!action || id !== action.target) return;
        const token = ++generation, revision = state.revision;
        performing = true; refresh();
        const accepted = world.playAction(action.id, { onComplete:() => {
          if (!visible() || token !== generation || state.revision !== revision) return;
          performing = false;
          try {
            persist(dispatchSeries(state,{type:'perform',action:action.id,revision}));
            if (['complete','departure'].includes(state.stage)) messages([...content.result(state),...content.ending(state)]);
            else refresh();
          } catch (error) { world.applyStory(state); messages([{speaker:'진행 안내',text:error.message}]); }
        } });
        if (!accepted) { performing = false; refresh(); }
      } else if (id === 'consult') messages(content.stage(state), choices);
    } catch (e) { performing = false; messages([{speaker:'진행 안내',text:e.message}]); }
  }
  function depart() {
    if (locked() || state.stage !== 'departure') return;
    const next = dispatchSeries(state,{type:'depart'}); transition.start(state.episodeId,next.episodeId);
  }
  function transitionFailure(error) {
    if (closed) return;
    ++dialogGeneration; overlay.hidden = true; setDialog(true); panel.replaceChildren();
    panel.append(element('h2','이동을 완료하지 못했습니다'),element('p',error.message));
    button('이동 다시 시도', () => { setDialog(false); transition.retry(); });
    if (state) button('현재 장소에 머무르기', () => { setDialog(false); transition.cancel(); refresh(); });
  }
  world = mountSeriesWorld(stage,{ onInteract:interact, onStep:()=>gameAudio.playWorld?.('step'), onSound:(kind,spatial)=>gameAudio.playWorld?.(kind,spatial), onExit:depart,
    onFrame:dt=>{ if(visible()) transition?.tick(dt); } });
  transition = createSeriesTransition({
    prepare:async()=>pendingStart ?? dispatchSeries(state,{type:'depart'}),
    commit:(_,next)=>{
      if (!visible()) throw Error('창으로 돌아온 뒤 이동을 다시 시도하세요.');
      const previous = state;
      try { project(next); } catch(error) { if(previous)project(previous); throw error; }
      presentation.cursor = 0; persist(next); pendingStart = null; gameAudio.setScene?.(next.episodeId);
    },
    onLock:()=>{ if(!closed) { world.update({locked:locked()}); if(state)refresh(); } },
    onFrame:f=>{
      if (closed) return;
      const arrived = f.phase === 'idle' && lastTransitionPhase === 'arriving'; lastTransitionPhase = f.phase;
      overlay.hidden = f.phase === 'idle'; overlay.style.opacity = String(f.cover); overlay.dataset.style = f.style ?? ''; coverTitle.textContent = f.title ?? '';
      world.setTransition?.(f); gameAudio.setTransition?.({opacity:f.cover,active:f.phase!=='idle'});
      if (arrived) { const token = generation; queueMicrotask(()=>{ if(!closed && token===generation)arrival(); }); }
    }, onError:transitionFailure, reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  button('기록 내려받기', () => {
    if (!state) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(recordFor(),null,2)],{type:'application/json'}));
    const a = element('a'); a.href=url; a.download='돌아가는-길.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  },menu);
  const upload = element('input'); upload.type='file'; upload.accept='.json,application/json'; upload.hidden=true; root.append(upload);
  const importButton = button('기록 불러오기',()=>upload.click(),menu);
  upload.onchange = async () => {
    const file = upload.files?.[0]; upload.value='';
    if (!file || !visible() || importing || performing || transition.status !== 'idle') return;
    const token = ++generation; importing = true; ++dialogGeneration;
    if(!state)pendingStart=null;
    setDialog(false); refresh();
    try {
      if(file.size>2*1024*1024)throw Error('기록 파일은 2MB 이하여야 합니다.');
      const restored = readRecord(JSON.parse(await file.text()));
      if(!visible() || token!==generation)return;
      const previous = state;
      try { project(restored.state); } catch(error) { if(previous)project(previous); throw error; }
      presentation=restored.presentation; pendingStart=null; warning=''; persist(restored.state); gameAudio.setScene?.(state.episodeId);
      importing=false; arrival(); refresh();
    } catch(e) { if(visible() && token===generation)messages([{speaker:'기록을 불러오지 못했습니다',text:e.message}], () => { if(!state)initialWelcome(); }); }
    finally { if(token===generation) { importing=false; refresh(); } }
  };
  function dispose() {
    if(closed)return;
    closed=true; ++generation; ++dialogGeneration; document.removeEventListener('visibilitychange',visibility);
    transition.dispose(); world.dispose(); gameAudio.setDialogue?.(false); gameAudio.setTransition?.({opacity:0,active:false}); gameAudio.setScene?.(1); root.remove();
  }
  button('박물관 기록으로',()=>{dispose();onClose?.();},menu);
  function visibility() {
    if(closed)return;
    if(document.hidden) {
      if(performing) { ++generation; performing=false; world.cancelAction?.(); world.applyStory(state); }
      if(importing) { ++generation; importing=false; }
      gameAudio.setDialogue?.(false);
    } else {
      if(!state && !pendingStart && !importing)initialWelcome();
      gameAudio.setDialogue?.(dialogOpen); if(arrivalQueued)arrival();
    }
    world.update({locked:locked()}); refresh();
  }
  document.addEventListener('visibilitychange',visibility);
  function initialWelcome() {
    pendingStart=null; panel.replaceChildren();
    title.textContent='돌아가는 길'; objective.textContent='다음 모임을 준비하는 새로운 여정'; setDialog(true);
    if(warning)panel.append(element('p',warning));
    panel.append(element('p','모로와 함께 갈까요? 동행 전 인계를 확인하고 필요한 충전을 마칩니다. 기록 봉인은 유지합니다.'));
    for(const follow of [true,false])button(follow?'모로와 함께 간다':'담당자에게 맡기고 간다',()=>{
      if(pendingStart)return;
      pendingStart=createSeries(museumView,{moroAccompanies:follow});
      messages(content.bridge(museumView,follow),()=>{setDialog(false);transition.start(1,pendingStart.episodeId);});
    });
  }
  if(!state)initialWelcome(); else { setup(); arrival(); }
  return { dispose, diagnostics(){return {view:state?getSeriesView(state):null,world:world.diagnostics(),transition:transition.status,performing,importing,presentation};} };
}
