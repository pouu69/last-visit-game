// @ts-check
(function (root) {
  'use strict';
  /** @typedef {{id:string, title:string, detail:string, result:string, add?:string[], remove?:string[], route?:string, plan?:string, credit?:string}} Choice */
  /** @typedef {{page:string, chapter:number, place:string, time:string, title:string, image:string, paragraphs:string[], question:string, discussion:string, choices:Choice[], mission?:{intro:string, clues:string[], hints:string[], answer:string, explanation:string, grid?:string[][]}}} Scene */
  /** @typedef {{step:number, scene:string, title:string, choice:string, label:string, result:string}} Entry */
  /** @typedef {{team:number, name:string, step:number, route:string, plan:string, credit:string, flags:string[], history:Entry[]}} State */
  /** @typedef {{id:string, title:string, subtitle:string, paragraphs:string[], question:string, image:string}} Ending */
  /** @typedef {{flagNames:Record<string,string>, scene:(s:State)=>Scene, ending:(s:State)=>Ending, total:number, title:string}} Story */
  /** @type {Story} */
  let story;
  const VERSION = 'museum-1';
  const MAX_SAVE_BYTES = 20 * 1024;
  const NAME_LIMIT = 20;
  /** @param {Story} value */
  function register(value) {
    story = value;
  }
  /** @param {unknown} team @param {unknown} name @returns {{ok:true,state:State}|{ok:false,error:string}} */
  function create(team, name) {
    if (!Number.isInteger(team) || typeof team !== 'number' || team < 1 || team > 3) {
      return { ok: false, error: '팀 번호는 1, 2, 3 중 하나를 선택해 주세요.' };
    }
    if (typeof name !== 'string' || /[\u0000-\u001f\u007f]/.test(name)) {
      return { ok: false, error: '팀 이름에는 줄바꿈이나 제어문자를 넣을 수 없습니다. 이름만 입력해 주세요.' };
    }
    const cleanName = name.trim();
    if (!cleanName || Array.from(cleanName).length > NAME_LIMIT) {
      return { ok: false, error: '팀 이름은 공백을 제외하고 1~20자로 입력해 주세요.' };
    }
    return { ok: true, state: { team, name: cleanName, step: 0, route: '', plan: '', credit: '', flags: [], history: [] } };
  }
  /** @param {State} state @param {string} flag */
  function has(state, flag) {
    return state.flags.includes(flag);
  }
  /** @param {State} state @param {unknown} choiceId @returns {{ok:true,state:State,entry:Entry}|{ok:false,error:string}} */
  function choose(state, choiceId) {
    if (state.step >= story.total) {
      return { ok: false, error: '이 모험은 이미 끝났습니다. 기록을 저장하거나 다른 팀으로 새 모험을 시작해 주세요.' };
    }
    const scene = story.scene(state);
    const choice = scene.choices.find((item) => item.id === choiceId);
    if (!choice) {
      return { ok: false, error: '선택은 현재 장면의 A, B, C, D 중 하나를 골라 주세요.' };
    }
    const flags = new Set(state.flags);
    for (const flag of choice.remove || []) flags.delete(flag);
    for (const flag of choice.add || []) flags.add(flag);
    const entry = { step: state.step, scene: scene.page, title: scene.title, choice: choice.id, label: choice.title, result: choice.result };
    return { ok: true, entry, state: {
      ...state, step: state.step + 1, route: choice.route || state.route,
      plan: choice.plan || state.plan, credit: choice.credit || state.credit,
      flags: [...flags].sort(), history: [...state.history, entry],
    } };
  }
  /** @param {string} text */
  function checksum(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
      hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  /** @param {State} state */
  function serialize(state) {
    const payload = { version: VERSION, team: state.team, name: state.name, choices: state.history.map((entry) => entry.choice) };
    const encoded = JSON.stringify(payload);
    return JSON.stringify({ payload, checksum: checksum(encoded) }, null, 2);
  }
  /** @param {unknown} text @returns {{ok:true,state:State}|{ok:false,error:string}} */
  function restore(text) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_SAVE_BYTES) {
      return { ok: false, error: '저장 파일은 20KB 이하의 JSON 파일이어야 합니다. 이 게임에서 저장한 파일을 선택해 주세요.' };
    }
    let data;
    try { data = JSON.parse(text); } catch {
      return { ok: false, error: '저장 파일의 JSON을 읽을 수 없습니다. 다운로드한 .json 파일을 수정하지 않고 다시 선택해 주세요.' };
    }
    if (!data || typeof data !== 'object' || !data.payload || typeof data.payload !== 'object') {
      return { ok: false, error: '이 게임의 저장 형식이 아닙니다. 「모험 파일 저장」으로 받은 파일을 선택해 주세요.' };
    }
    const payload = data.payload;
    if (payload.version !== VERSION) {
      return { ok: false, error: '저장 파일 버전이 이 작품과 다릅니다. 파일을 저장한 버전의 게임을 열어 주세요.' };
    }
    const created = create(payload.team, payload.name);
    if (!created.ok) return created;
    if (!Array.isArray(payload.choices) || payload.choices.length > story.total || payload.choices.some((id) => !['A', 'B', 'C', 'D'].includes(id))) {
      return { ok: false, error: '선택 이력이 손상되었습니다. A~D 선택이 최대 12개인 원본 저장 파일을 사용해 주세요.' };
    }
    const canonical = { version: VERSION, team: payload.team, name: payload.name, choices: payload.choices };
    if (data.checksum !== checksum(JSON.stringify(canonical))) {
      return { ok: false, error: '저장 파일 내용이 변경되었거나 손상되었습니다. 마지막으로 다운로드한 원본 파일을 다시 선택해 주세요.' };
    }
    let state = created.state;
    for (const id of payload.choices) {
      const result = choose(state, id);
      if (!result.ok) return result;
      state = result.state;
    }
    return { ok: true, state };
  }
  const api = { register, create, has, choose, serialize, restore, checksum, VERSION, MAX_SAVE_BYTES };
  root.Museum = api;
})(/** @type {any} */ (globalThis));
