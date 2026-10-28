import { mountMuseum } from './museum-scene.mjs';
import { mountInvestigation } from './investigation-ui.mjs';
import { ROOMS, CORRIDORS, CONNECTIONS } from './museum-map.mjs';
import { createLocalSessions } from '../src/local-sessions.mjs';
import { playerNameForSession } from '../src/player-name.mjs';
import { openingContent } from '../src/content/opening.mjs';
import { mountInvitationIntro } from './invitation-intro.mjs';
import { gameAudio } from './audio.mjs';

const $ = (id) => document.getElementById(id);
const LABELS = {
  charter: '옛 반환 규약',
  log: '서명된 실행 로그',
  statement: '윤서의 서명 진술',
  request: '반환 요청과 수신 확인',
  battery: '비상 배터리',
  map: '배수 통로 도면',
  maintenance: '배수선 점검 완료',
  repair: '종이 보수 도구',
};
const RESOURCES = new Set(['battery', 'map', 'maintenance', 'repair']);
const NPC_NAMES = { moro: '모로', yunseo: '윤서', nara: '나래' };
const DOCUMENT_SPEAKERS = new Set([
  '규약 사본',
  '나래의 기록',
  '나래의 요청',
  '안내문',
  '안내판',
  '옛 표제',
  '요청서',
  '운송표',
  '초대장',
]);
const STATUS = {
  boat: {
    locked: '종이배 미확보',
    intact: '온전한 종이배',
    damaged: '손상된 종이배',
    sealed: '밀봉된 종이배',
  },
  record: {
    locked: '원본 장부 미확보',
    intact: '보존한 원본',
    unreadable: '글자가 번진 원본',
    sealed: '밀봉된 원본',
  },
  moro: { active: '모로 작동 중', asleep: '모로 충전 대기' },
};
const FACTS = {
  request_received: '윤서가 요청을 받은 사실을 인정함',
  return_delayed: '윤서가 반환 처리를 미뤘음을 인정함',
  return_clause_removed: '반환 조항이 전시 안내에서 빠진 사실을 확인함',
};
const LAST_SESSION_KEY = 'museum-last-session-v1';
const OBJECTIVES = {
  S01: '사라진 종이배의 흔적을 찾을 곳을 정하세요.',
  I01: '모로의 이동 흔적과 정비함을 살펴보세요.',
  I02: '겹쳐 붙인 기증 기록의 표제를 확인하세요.',
  I03: '물자국과 바퀴 흔적이 향하는 곳을 살펴보세요.',
  I04: '반환실 열쇠와 윤서의 설명을 대조하세요.',
  P11: '네 단서에 맞는 도장의 순서를 찾으세요.',
  P12: '통행할 수 있는 가장 짧은 길을 고르세요.',
  S12: '배를 옮긴 이유를 누구에게 먼저 물을지 정하세요.',
  T21: '모로가 따른 명령과 작업 순서를 들어 보세요.',
  T22: '윤서의 말과 실제 기록이 일치하는지 확인하세요.',
  D21: '원래 규약과 현재 안내를 나란히 살펴보세요.',
  D22: '배수선의 상태를 확인하고 구조를 준비하세요.',
  S22: '나래의 약속을 듣고 마지막 준비를 정하세요.',
  P21: '실행 전에 인양 작업의 안전한 순서를 정하세요.',
  R31: '지킬 물건과 현재 쓸 수 있는 구조 방법을 살펴보세요.',
  R32: '멈춘 장치에서 가능한 복구 방법을 정하세요.',
  S31: '나래에게 구조 결과를 알리고 다음 행동을 정하세요.',
  F31: '배의 상태를 확인하고 반환 방법을 마무리하세요.',
  F32: '확보한 자료로 무엇을 바로잡을 수 있는지 확인하세요.',
  F33: '모로의 전원과 기록을 안전하게 인계하세요.',
  F34: '물품과 기록의 인계 책임을 남기고 현장을 떠나세요.',
};
let sessionId = null;
let view = null;
let busy = false;
let invitationPending = false;
let selected = null;
let choicesDismissed = false;
let dialogueDismissed = false;
let sessionEpoch = 0;
let renderedSession = null;
let renderedScene = null;
let renderedMessages = [];
let renderedCurrentMessage = null;
let observationFeedbackTimer = null;
let sessions = {};
let archivedSessions = [];
let lastEnteredSession = null;
let museum;
let investigation;
let navigation = null;
let mapExpanded = false;
let mapReturnFocus = null;
let restoreMapFocusOnClose = true;
let investigationPanelOpen = false;
let renderedPhase = null;
let lastTravel = null;
let pendingTalk = null;
let cameraExpanded = false;
let cameraSettings = null;
let storageWarning = '';
let registryWarning = '';
let browserStorage = null;

try {
  browserStorage = window.localStorage;
} catch {
  storageWarning = '이 브라우저에는 저장할 수 없습니다. 기록 내려받기로 진행을 보관해 주세요.';
  notice(storageWarning);
}
const game = createLocalSessions({ storage: browserStorage });
const invitationLetter = openingContent().messages.find((item) => item.speaker === '초대장');
const invitationIntro = mountInvitationIntro($('invitation-intro'), {
  message: invitationLetter?.text ?? '',
  recipient: '마지막 관람객 여러분께',
});

try {
  const saved = JSON.parse(browserStorage?.getItem('museum-local-sessions-v1') ?? '{}');
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    sessions = Object.fromEntries(
      Object.entries(saved).filter(
        ([id, token]) =>
          ['1', '2', '3'].includes(id) &&
          typeof token === 'string' &&
          /^[a-f0-9]{48}$/.test(token)
      )
    );
  }
} catch {
  notice('저장된 팀 목록을 읽지 못했습니다. 기록 파일이 있다면 불러와 주세요.');
}
try {
  const saved = JSON.parse(browserStorage?.getItem('museum-local-session-archive-v1') ?? '[]');
  if (Array.isArray(saved))
    archivedSessions = saved.filter(
      (item) =>
        [1, 2, 3].includes(item?.teamId) &&
        typeof item.sessionId === 'string' &&
        /^[a-f0-9]{48}$/.test(item.sessionId)
    );
} catch {
  notice('이전 기록 목록을 읽지 못했습니다. 내려받은 기록 파일로 이어갈 수 있습니다.');
}
try {
  const saved = JSON.parse(browserStorage?.getItem(LAST_SESSION_KEY) ?? 'null');
  if (
    [1, 2, 3].includes(saved?.teamId) &&
    typeof saved.sessionId === 'string' &&
    /^[a-f0-9]{48}$/.test(saved.sessionId)
  )
    lastEnteredSession = { teamId: saved.teamId, sessionId: saved.sessionId };
} catch {
  // Older or malformed markers fall back to the current saved team records.
}
try {
  museum = mountMuseum($('museum-stage'), {
    onInspect: (hotspotId) => {
      if (busy || $('game').hidden || document.querySelector('dialog[open]')) {
        pendingTalk = null;
        return;
      }
      gameAudio.play('inspect');
      const talk = pendingTalk;
      pendingTalk = null;
      if (
        talk?.sessionId === sessionId &&
        talk.sceneId === view?.sceneId &&
        talk.hotspotId === hotspotId &&
        view.npc &&
        ['exploring', 'input'].includes(view.phase)
      ) {
        openPanel('conversation-panel');
        return;
      }
      act('INSPECT', { hotspotId });
    },
    onArrive: (roomId) => {
      if (!busy && view?.phase === 'travelling' && view.travel?.toRoomId === roomId)
        act('ARRIVE', { roomId });
    },
    onNavigation: (position) => {
      navigation = position;
      renderNavigation();
    },
    onCameraChange: (settings) => {
      cameraSettings = settings;
      renderCameraControls();
    },
  });
} catch {
  $('museum-stage').append(element('p', '박물관의 불이 하나둘 꺼집니다.'));
}
window.museumDiagnostics = () => museum?.diagnostics();
investigation = mountInvestigation($('investigation'), {
  act: (type, extra) => {
    if (type === 'INSPECT' && isMapMode()) {
      pendingTalk = null;
      if (!museum?.approach(extra.hotspotId))
        notice(
          '이 사물로 가는 길을 찾지 못했습니다. 가까운 통로로 이동한 뒤 다시 눌러 주세요.'
        );
      else focusFloor();
      return;
    }
    return act(type, extra);
  },
  onTalk: talkToNpc,
  onChoices: () => act('OPEN_CHOICES'),
  npcName: (id) => NPC_NAMES[id] ?? '인물',
  onHelp: () => openPanel('help-panel'),
  onPanelChange: (opened) => {
    investigationPanelOpen = opened;
    updateMuseum();
    renderCameraControls();
  },
});

function isMapMode() {
  return view?.mode === 'map' || view?.storyVersion === 'museum-map-3';
}
function talkToNpc() {
  pendingTalk = null;
  if (!isMapMode()) {
    openPanel('conversation-panel');
    return;
  }
  if (busy || !view.npc || !['exploring', 'input'].includes(view.phase)) return;
  const anchor = view.npc === 'nara' ? 'terminal' : view.npc;
  const hotspot = view.exploration?.hotspots.find((item) => item.anchor === anchor);
  if (!hotspot) {
    notice('이 장면의 대화 상대를 찾지 못했습니다. 장면을 다시 열어 주세요.');
    return;
  }
  dialogueDismissed = true;
  render();
  pendingTalk = { sessionId, sceneId: view.sceneId, hotspotId: hotspot.id };
  if (!museum?.approach(hotspot.id)) {
    pendingTalk = null;
    notice(
      `${
        NPC_NAMES[view.npc]
      }에게 가는 길을 찾지 못했습니다. 가까운 통로로 이동한 뒤 다시 눌러 주세요.`
    );
    return;
  }
  if (!document.querySelector('dialog[open]')) focusFloor();
}
function focusFloor() {
  $('museum-stage').querySelector('canvas')?.focus({ preventScroll: true });
}
function toggleCamera(expanded = !cameraExpanded) {
  cameraExpanded = expanded;
  renderCameraControls();
  $('camera-toggle').focus({ preventScroll: true });
}
function renderCameraControls() {
  const tools = $('camera-tools');
  tools.hidden =
    $('game').hidden ||
    typeof museum?.adjustCamera !== 'function' ||
    mapExpanded ||
    investigationPanelOpen ||
    !!document.querySelector('dialog[open]');
  if (tools.hidden) cameraExpanded = false;
  document.body.dataset.cameraTools = tools.hidden ? 'hidden' : 'visible';
  document.body.dataset.cameraExpanded = String(cameraExpanded);
  $('camera-toggle').setAttribute('aria-expanded', String(cameraExpanded));
  $('camera-toggle').lastElementChild.textContent = cameraExpanded ? '−' : '＋';
  $('camera-panel').hidden = !cameraExpanded;
  if (cameraSettings) {
    $('camera-readout').textContent = `${Math.round(
      cameraSettings.zoom * 100
    )}% · 시선 높이 ${Math.round(cameraSettings.pitch)}°`;
    $('camera-readout').setAttribute(
      'aria-label',
      `확대 ${Math.round(cameraSettings.zoom * 100)}퍼센트, 시선 높이 ${Math.round(
        cameraSettings.pitch
      )}도, 회전 ${Math.round(cameraSettings.yaw)}도`
    );
  }
  if (!cameraExpanded) return;
  const panelTop = $('camera-toggle').getBoundingClientRect().bottom + 8;
  const panelBounds = $('camera-panel').getBoundingClientRect();
  const lower = [
    ...document.querySelectorAll('.dialogue-shell, .investigation-dock'),
  ]
    .filter((item) => item.getClientRects().length > 0)
    .map((item) => item.getBoundingClientRect())
    .filter((bounds) => bounds.right > panelBounds.left && bounds.left < panelBounds.right)
    .map((bounds) => bounds.top - 12);
  const bottom = Math.min(window.innerHeight - 24, ...lower);
  tools.style.setProperty('--camera-space', `${Math.max(44, bottom - panelTop)}px`);
}
function toggleMap(expanded = !mapExpanded, { restoreFocus = true } = {}) {
  pendingTalk = null;
  const hud = $('navigation-hud');
  if (expanded) {
    if (!isMapMode() || $('game').hidden) return;
    if (!hud.open) mapReturnFocus = document.activeElement;
    restoreMapFocusOnClose = true;
    mapExpanded = true;
    renderNavigation();
    if (!hud.open) hud.showModal();
  } else {
    restoreMapFocusOnClose = restoreFocus;
    mapExpanded = false;
    if (hud.open) hud.close();
  }
  hud.classList.toggle('expanded', mapExpanded);
  $('map-toggle').setAttribute('aria-expanded', String(mapExpanded));
  renderNavigation();
  updateMuseum();
  renderCameraControls();
  if (expanded) $('map-close').focus({ preventScroll: true });
}
function initializeMap() {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = $('museum-map');
  const shape = (tag, attrs, text) => {
    const item = document.createElementNS(namespace, tag);
    for (const [key, value] of Object.entries(attrs)) item.setAttribute(key, String(value));
    if (text) item.textContent = text;
    return item;
  };
  for (const area of CORRIDORS)
    svg.append(
      shape('rect', {
        x: area.x - area.width / 2,
        y: area.z - area.depth / 2,
        width: area.width,
        height: area.depth,
        class: 'map-corridor',
      })
    );
  for (const room of ROOMS) {
    const group = shape('g', { 'data-room': room.id });
    group.append(
      shape('rect', {
        x: room.x - room.width / 2,
        y: room.z - room.depth / 2,
        width: room.width,
        height: room.depth,
        rx: 0.6,
        class: 'floor-room',
      }),
      shape('text', { x: room.x, y: room.z + 0.5, class: 'floor-label' }, room.label)
    );
    svg.append(group);
  }
  svg.append(
    shape('polyline', { id: 'navigation-route', class: 'navigation-route', points: '' }),
    shape('circle', { id: 'navigation-player', cx: 0, cy: 3, r: 0.85 })
  );
}
function renderNavigation() {
  const hud = $('navigation-hud');
  const available = isMapMode() && !$('game').hidden;
  $('map-toggle').hidden = !available;
  hud.hidden = !mapExpanded;
  hud.classList.toggle('expanded', mapExpanded);
  $('map-toggle').setAttribute('aria-expanded', String(mapExpanded));
  if (!available || !mapExpanded || !view) return;
  const roomId = navigation?.roomId ?? view.currentRoomId;
  const current = ROOMS.find((room) => room.id === roomId);
  const destination = ROOMS.find((room) => room.id === view.travel?.toRoomId);
  $('navigation-room').textContent =
    navigation && !navigation.roomId ? '이동 통로' : current?.label ?? '박물관';
  $('navigation-destination').textContent = destination
    ? `목적지 · ${destination.label}`
    : '현장 탐색';
  for (const room of hud.querySelectorAll('[data-room]')) {
    room.classList.toggle('current-room', room.dataset.room === navigation?.roomId);
    room.classList.toggle('destination-room', room.dataset.room === destination?.id);
  }
  const player = $('navigation-player');
  if (player) {
    player.setAttribute('cx', navigation?.x ?? current?.spawn[0] ?? 0);
    player.setAttribute('cy', navigation?.z ?? current?.spawn[1] ?? 3);
  }
  const paths = [[roomId]];
  const visited = new Set([roomId]);
  let route = [];
  while (destination && paths.length) {
    const path = paths.shift();
    if (path.at(-1) === destination.id) {
      route = path;
      break;
    }
    for (const edge of CONNECTIONS) {
      const next = edge[0] === path.at(-1) ? edge[1] : edge[1] === path.at(-1) ? edge[0] : null;
      if (next && !visited.has(next)) {
        visited.add(next);
        paths.push([...path, next]);
      }
    }
  }
  $('navigation-route')?.setAttribute(
    'points',
    route
      .map((id) => ROOMS.find((room) => room.id === id))
      .map((room) => `${room.x},${room.z}`)
      .join(' ')
  );
  const active =
    view.phase === 'travelling' ||
    (dialogueDismissed && ['exploring', 'input'].includes(view.phase));
  const nearby = active && navigation?.nearbyLabel;
  const touchInput = window.matchMedia('(pointer: coarse)').matches;
  const label = nearby
    ? touchInput
      ? '가까이 · 사물을 탭해 조사'
      : '가까이 · E 또는 클릭으로 조사'
    : view.phase === 'travelling'
    ? '목적지 방에 들어가면 이야기가 시작됩니다.'
    : active
    ? '사물에 가까이 가면 조사할 수 있어요.'
    : '이야기를 읽은 뒤 현장을 탐색하세요.';
  if ($('navigation-nearby').textContent !== label) $('navigation-nearby').textContent = label;
}
initializeMap();

function updateMuseum() {
  if (!view || $('game').hidden) {
    museum?.update({
      sceneId: 'S01',
      flags: { boat: 'locked', record: 'locked', moro: 'active' },
      phase: 'reading',
      speaker: null,
      messageId: null,
      hotspots: [],
      activeHotspot: null,
      objectiveTarget: null,
      mode: null,
      currentRoomId: null,
      travel: null,
      interactive: false,
    });
    return;
  }
  const current = view.currentMessage ?? view.messages.at(-1);
  museum?.update({
    playthroughId: sessionEpoch,
    sceneId: view.sceneId,
    flags: view.flags,
    phase: view.phase,
    speaker: current?.speaker ?? null,
    messageId: current?.id ?? null,
    mode: view.mode,
    storyVersion: view.storyVersion,
    currentRoomId: view.currentRoomId,
    visitedRoomIds: view.visitedRoomIds,
    travel: view.travel,
    hotspots: view.exploration?.hotspots ?? [],
    // A dismissed dialogue must release its close-up, which also locks walking.
    activeHotspot: dialogueDismissed ? null : view.exploration?.activeHotspot ?? null,
    objectiveTarget: view.travel ? { roomId: view.travel.toRoomId } : null,
    interactive:
      (view.phase === 'travelling' ||
        (!!view.exploration &&
          dialogueDismissed &&
          ['exploring', 'input'].includes(view.phase))) &&
      !mapExpanded &&
      !investigationPanelOpen &&
      !busy &&
      !document.hidden &&
      !document.querySelector('dialog[open]'),
  });
}

function openPanel(id) {
  pendingTalk = null;
  if (id === 'menu-panel') $('skip-intro').hidden = $('game').hidden || !view?.canSkipIntro;
  for (const panel of document.querySelectorAll('dialog[open]'))
    if (panel.id !== id) {
      if (panel.id === 'navigation-hud') toggleMap(false, { restoreFocus: false });
      else panel.close();
    }
  if (!$(id).open) {
    $(id).showModal();
    if (id === 'decision-panel')
      $('choices').querySelector('.choice')?.focus({ preventScroll: true });
  }
  updateMuseum();
  renderCameraControls();
}
function closePanels() {
  pendingTalk = null;
  for (const panel of document.querySelectorAll('dialog[open]')) {
    if (panel.id === 'navigation-hud') toggleMap(false, { restoreFocus: false });
    else panel.close();
  }
}

function notice(message) {
  $('notice').textContent = message;
  for (const item of document.querySelectorAll('.panel-notice')) item.remove();
  const panel = document.querySelector('dialog[open]');
  if (message && panel) {
    const item = element('p', message, 'panel-notice');
    item.setAttribute('role', 'alert');
    panel.prepend(item);
  }
}
function clearObservationFeedback() {
  window.clearTimeout(observationFeedbackTimer);
  observationFeedbackTimer = null;
  $('observation-feedback').hidden = true;
}
function showObservationFeedback() {
  clearObservationFeedback();
  $('observation-feedback').hidden = false;
  observationFeedbackTimer = window.setTimeout(clearObservationFeedback, 2600);
}
function element(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}
function button(text, action, className, actionId) {
  const item = element('button', text, className);
  item.type = 'button';
  if (actionId) item.dataset.action = actionId;
  item.addEventListener('click', action);
  return item;
}
function setBusy(value) {
  busy = value;
  investigation?.setBusy(value);
  $('game').setAttribute('aria-busy', String(value));
  $('welcome').setAttribute('aria-busy', String(value));
  for (const control of document.querySelectorAll('button')) {
    control.disabled = control.dataset.unavailable === 'true';
    if (value && !control.dataset.close) control.setAttribute('aria-disabled', 'true');
    else control.removeAttribute('aria-disabled');
  }
  $('save-button').disabled = value || !view;
  $('save-status').textContent = value
    ? '이 브라우저에 기록하는 중…'
    : storageWarning || registryWarning
    ? '임시 진행 중 · 기록을 내려받아 주세요'
    : view
    ? '이 브라우저에 진행 저장됨'
    : '진행은 이 브라우저에 저장됩니다';
  updateMuseum();
  renderCameraControls();
}
function sessionNotice(result, message = '') {
  storageWarning = result.warning ?? '';
  notice([message, storageWarning, registryWarning].filter(Boolean).join(' '));
}
function storeSessions() {
  if (!browserStorage) {
    registryWarning =
      '이 브라우저에는 저장할 수 없습니다. 기록 내려받기로 진행을 보관해 주세요.';
    return;
  }
  try {
    browserStorage.setItem('museum-local-sessions-v1', JSON.stringify(sessions));
    browserStorage.setItem('museum-local-session-archive-v1', JSON.stringify(archivedSessions));
    if (lastEnteredSession)
      browserStorage.setItem(LAST_SESSION_KEY, JSON.stringify(lastEnteredSession));
    registryWarning = '';
  } catch {
    registryWarning =
      '이 브라우저에는 팀 목록을 저장할 수 없습니다. 기록 내려받기로 진행을 보관해 주세요.';
  }
}
function rememberSession(teamId, token) {
  const previous = sessions[teamId];
  if (
    previous &&
    previous !== token &&
    !archivedSessions.some((item) => item.sessionId === previous)
  )
    archivedSessions.push({ teamId, sessionId: previous });
  archivedSessions = archivedSessions.filter((item) => item.sessionId !== token);
  sessions[teamId] = token;
  lastEnteredSession = { teamId, sessionId: token };
  storeSessions();
}
function latestSessionRecord() {
  if (lastEnteredSession) {
    const { teamId, sessionId: token } = lastEnteredSession;
    if (sessions[teamId] === token || archivedSessions.some((item) => item.sessionId === token))
      return { teamId, sessionId: token };
  }
  const current = [1, 2, 3].find((id) => sessions[id]);
  if (current) return { teamId: current, sessionId: sessions[current] };
  return archivedSessions.at(-1) ?? null;
}
function teamButtons() {
  const records = Object.entries(sessions)
    .map(([teamId, token]) => ({ teamId: Number(teamId), sessionId: token, current: true }))
    .concat([...archivedSessions].reverse());
  $('saved-records').hidden = !records.length;
  $('saved-record-list')?.replaceChildren(
    ...records.map((record, index) =>
      button(
        `${record.teamId}팀 · ${
          record.current ? '최근 기록' : `이전 기록 ${index + 1}`
        } 이어보기`,
        () => start(record.teamId, false, record.sessionId),
        'saved-record'
      )
    )
  );
  const continueButton = $('continue-game');
  if (continueButton) continueButton.hidden = !latestSessionRecord();
}
function showGame() {
  closePanels();
  $('museum-stage').inert = false;
  document.body.dataset.screen = 'game';
  $('welcome').hidden = true;
  $('comparison').hidden = true;
  $('game').hidden = false;
  $('notebook-toggle').hidden = false;
  $('history-toggle').hidden = false;
  mapExpanded = false;
  $('navigation-hud').classList.remove('expanded');
  $('map-toggle').setAttribute('aria-expanded', 'false');
  cameraExpanded = false;
}
function showTeams() {
  clearObservationFeedback();
  closePanels();
  $('museum-stage').inert = true;
  document.body.dataset.screen = 'welcome';
  sessionEpoch += 1;
  $('welcome').hidden = false;
  $('game').hidden = true;
  $('comparison').hidden = true;
  $('notebook-toggle').hidden = true;
  $('history-toggle').hidden = true;
  renderNavigation();
  renderCameraControls();
  updateMuseum();
  teamButtons();
  window.scrollTo(0, 0);
  $('welcome-title').setAttribute('tabindex', '-1');
  $('welcome-title').focus({ preventScroll: true });
}
async function start(teamId, fresh = false, savedToken = null) {
  if (busy) return false;
  clearObservationFeedback();
  pendingTalk = null;
  const fromTitle = document.body.dataset.screen === 'welcome' && $('game').hidden;
  const epoch = ++sessionEpoch;
  let transitioning = false;
  setBusy(true);
  const token = !fresh ? savedToken ?? sessions[teamId] : null;
  try {
    const overlay = $('screen-transition');
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (fromTitle && overlay && !reducedMotion) {
      transitioning = true;
      document.body.dataset.titleTransition = 'leaving';
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'true');
      requestAnimationFrame(() => overlay.classList.add('is-covered'));
      await new Promise((resolve) => setTimeout(resolve, 220));
      if (epoch !== sessionEpoch) return false;
    }
    const result = token ? game.get(token) : game.create(teamId);
    sessionId = token ?? result.sessionId;
    rememberSession(teamId, sessionId);
    view = result.view;
    navigation = null;
    selected = null;
    choicesDismissed = false;
    dialogueDismissed = false;
    $('team-recovery').replaceChildren();
    showGame();
    sessionNotice(result);
    render(true);
    if (transitioning) {
      overlay.classList.remove('is-covered');
      await new Promise((resolve) => setTimeout(resolve, 450));
      if (epoch !== sessionEpoch) return false;
    }
    if (!document.querySelector('dialog[open]')) {
      const firstIntro =
        view.sceneId === 'O00' &&
        view.phase === 'exploring' &&
        view.messages.length === 1 &&
        !dialogueDismissed;
      const target = firstIntro
        ? document.querySelector('#reading-controls [data-action="explore"]')
        : dialogueDismissed && view.exploration
        ? $('museum-stage').querySelector('canvas')
        : document.querySelector('#reading-controls [data-action="next"]') ??
          document.querySelector('#reading-controls [data-action="explore"]') ??
          document.querySelector('#reading-controls [data-action="continue"]') ??
          $('scene-title');
      target?.focus({ preventScroll: true });
    }
    return true;
  } catch (error) {
    notice(error.message);
    if (token) {
      $('team-recovery').replaceChildren(
        element(
          'p',
          `이 브라우저에서 ${teamId}팀의 기존 진행을 읽지 못했습니다. 기록 파일을 불러오거나 새 기록을 만들 수 있습니다.`
        ),
        button(`${teamId}팀 새 기록 만들기`, () => start(teamId, true), 'text-button')
      );
    }
    return false;
  } finally {
    if (transitioning) {
      const overlay = $('screen-transition');
      overlay?.classList.remove('is-covered');
      if (overlay) overlay.hidden = true;
      delete document.body.dataset.titleTransition;
    }
    setBusy(false);
  }
}
async function act(type, extra = {}) {
  if (busy || !view) return false;
  if (type === 'INSPECT') extra = { ...extra, resume: true };
  if (type === 'EXPLORE') extra = { ...extra, preserveReading: true };
  if (type === 'OPEN_CHOICES' && view.exploration?.canPlanInvestigation)
    extra = { ...extra, fromObservations: true };
  pendingTalk = null;
  setBusy(true);
  const previousScene = view.sceneId;
  const previousObservationCount = view.observations?.length ?? 0;
  const focusAction =
    document.activeElement?.dataset.action ??
    (['INSPECT', 'ARRIVE'].includes(type) ? 'next' : null);
  try {
    const result = game.event(sessionId, {
      type,
      teamId: view.teamId,
      sceneId: view.sceneId,
      revision: view.revision,
      ...extra,
    });
    view = result.view;
    if (type !== 'HINT') selected = null;
    choicesDismissed = type === 'BACK';
    if (type === 'EXPLORE' || type === 'BACK') dialogueDismissed = true;
    if (type === 'INSPECT') dialogueDismissed = false;
    sessionNotice(result);
    render(previousScene !== view.sceneId, focusAction, type === 'NEXT' || type === 'TOPIC');
    if ((view.observations?.length ?? 0) > previousObservationCount)
      showObservationFeedback();
    if (type === 'EXPLORE' && isMapMode()) focusFloor();
    return true;
  } catch (error) {
    notice(error.message);
    return false;
  } finally {
    setBusy(false);
  }
}
function messageKind(speaker) {
  if (speaker === '서술') return { kind: 'narration', label: '내레이션' };
  if (speaker === '게임' || speaker === '안내') return { kind: 'system', label: '진행 안내' };
  if (DOCUMENT_SPEAKERS.has(speaker)) return { kind: 'document', label: `단서 · ${speaker}` };
  if (speaker === '팀')
    return { kind: 'dialogue', label: view.playerName ?? playerNameForSession(sessionId) };
  return { kind: 'dialogue', label: speaker ?? '' };
}
function renderMessages(sceneChanged, followLatest) {
  const log = $('messages');
  const wasAtBottom = log.scrollHeight - log.clientHeight - log.scrollTop < 70;
  const matches =
    renderedSession === sessionId &&
    renderedScene === view.sceneId &&
    renderedMessages.length <= view.messages.length &&
    renderedMessages.every(
      (message, index) =>
        message.id === view.messages[index].id && message.text === view.messages[index].text
    );
  if (!matches) {
    log.replaceChildren();
    renderedMessages = [];
  }
  for (const message of view.messages.slice(renderedMessages.length)) {
    const { kind, label } = messageKind(message.speaker);
    const style =
      kind === 'narration'
        ? 'narrator'
        : kind === 'dialogue' && message.speaker === '팀'
        ? 'team'
        : kind;
    const item = element('article', undefined, `message ${style}`);
    item.append(element('span', label, 'speaker'));
    item.append(element('p', message.text));
    log.append(item);
  }
  renderedMessages = view.messages;
  renderedSession = sessionId;
  renderedScene = view.sceneId;
  if (sceneChanged) log.scrollTop = 0;
  else if (followLatest || wasAtBottom) log.scrollTop = log.scrollHeight;
  $('message-count').textContent = `${view.messages.length}개의 메시지`;
  const current = view.currentMessage ?? view.messages.at(-1);
  const { kind, label } = messageKind(current?.speaker);
  const changed = $('current-message').textContent !== current?.text;
  $('current-message').textContent = current?.text ?? '';
  $('current-message').className =
    kind === 'narration' ? 'narrator' : kind === 'dialogue' ? 'spoken' : kind;
  $('current-speaker').textContent = label;
  document.querySelector('.dialogue-shell').dataset.kind = kind;
  if (changed) $('current-message').scrollTop = 0;
  renderedCurrentMessage = current;
}
function renderNotebook() {
  const observations = $('notebook-observations');
  observations.replaceChildren();
  if (view.observations?.length || view.exploration) {
    observations.append(element('h2', '직접 관찰한 흔적'));
    const all =
      view.observations ??
      view.exploration.observations.map((item) => ({ ...item, sceneId: view.sceneId }));
    let sceneId = null;
    for (const observation of all) {
      if (observation.sceneId !== sceneId) {
        sceneId = observation.sceneId;
        observations.append(
          element(
            'p',
            observation.sceneTitle ?? (sceneId === view.sceneId ? view.title : '이전 조사'),
            'eyebrow'
          )
        );
      }
      const item = element('article', undefined, 'notebook-observation');
      item.append(element('h3', observation.label), element('p', observation.text));
      observations.append(item);
    }
    if (!all.length)
      observations.append(
        element('p', '사물을 끝까지 살펴보면 관찰이 여기에 남습니다.', 'inventory-empty')
      );
  }
  const inventory = $('inventory');
  inventory.replaceChildren();
  for (const [heading, ids, resource] of [
    [
      '보존한 자료',
      Object.keys(LABELS).filter((id) => !RESOURCES.has(id) && view.flags[id]),
      false,
    ],
    [
      '장비와 준비',
      Object.keys(LABELS).filter((id) => RESOURCES.has(id) && view.flags[id]),
      true,
    ],
  ]) {
    inventory.append(element('h2', heading));
    const group = element('div', undefined, 'inventory-group');
    group.append(
      ...(ids.length
        ? ids.map((id) => element('span', LABELS[id], `item ${resource ? 'resource' : ''}`))
        : [element('p', '아직 기록한 것이 없습니다.', 'inventory-empty')])
    );
    inventory.append(group);
  }
  const knownStatus = Object.keys(STATUS).filter(
    (id) =>
      view.flags[id] !== 'locked' && !(id === 'moro' && ['O00', 'S01'].includes(view.sceneId))
  );
  if (knownStatus.length) inventory.append(element('h2', '지금의 상태'));
  const statuses = element('div', undefined, 'inventory-group');
  statuses.append(
    ...knownStatus.map((id) => element('span', STATUS[id][view.flags[id]], 'item'))
  );
  inventory.append(statuses);
  const count = Object.keys(LABELS).filter((id) => view.flags[id]).length;
  $('evidence-count').textContent = `${count}개`;
  $('notebook-facts').replaceChildren(
    ...(view.knownFacts ?? []).filter((id) => FACTS[id]).map((id) => element('p', FACTS[id]))
  );
  $('route-history').replaceChildren(
    ...(view.history ?? []).map((entry) => element('li', entry.label ?? '함께 선택한 행동'))
  );
}
function continuationGuidance() {
  const next = view.nextScene;
  if (/^E[1-6]$/.test(next?.id))
    return { label: '결말 읽기', objective: '우리 팀의 선택이 남긴 결말을 읽어 보세요.' };
  if (!next || next.roomId === view.currentRoomId)
    return { label: '이야기 이어가기', objective: '이곳에서 다음 이야기를 이어가세요.' };
  const destination = next.roomLabel ?? next.title;
  return {
    label: `${destination}로 이동`,
    objective: `${destination}로 이동해 이야기를 이어가세요.`,
  };
}
function renderControls() {
  const controls = $('reading-controls');
  controls.replaceChildren();
  if (view.canHint || view.hints?.length)
    controls.append(
      button(
        '힌트 보기',
        async () => {
          if (view.canHint) await act('HINT');
          openPanel('hint-panel');
        },
        'quiet-button',
        'hint'
      )
    );
  if (view.exploration && ['exploring', 'input'].includes(view.phase))
    controls.append(button('현장으로', returnToField, 'primary', 'explore'));
  if (
    ['reading', 'input'].includes(view.phase) &&
    !/^E[1-6]$/.test(view.sceneId) &&
    !view.exploration
  ) {
    controls.append(
      button(
        view.phase === 'reading' ? '행동 먼저 보기' : '팀의 행동 고르기',
        () => act('OPEN_CHOICES'),
        'quiet-button',
        'choices'
      )
    );
  }
  if (view.phase === 'choosing' && !view.exploration?.puzzle)
    controls.append(
      button(
        '팀의 행동 고르기',
        () => {
          choicesDismissed = false;
          openPanel('decision-panel');
        },
        'primary',
        'choices'
      )
    );
  if (view.phase === 'input' && !view.exploration)
    controls.append(button(`${NPC_NAMES[view.npc]}에게 묻기`, talkToNpc, undefined, 'talk'));
  if (view.canNext)
    controls.append(button('계속 ▷', () => act('NEXT'), 'primary', 'next'));
  if (view.canContinue && (view.phase === 'result' || !view.exploration?.primaryAction))
    controls.append(
      button(`${continuationGuidance().label} →`, () => act('CONTINUE'), 'primary', 'continue')
    );
}
function canReturnToField() {
  return (
    !busy &&
    !$('game').hidden &&
    !document.querySelector('.dialogue-shell').hidden &&
    !!view?.exploration &&
    ((view.phase === 'reading' && !!view.exploration.activeHotspot) ||
      ['exploring', 'input'].includes(view.phase))
  );
}
function returnToField() {
  if (canReturnToField()) return act('EXPLORE');
  return Promise.resolve(false);
}
function renderDialogue() {
  const available =
    view.npc && (view.phase === 'input' || (view.exploration && view.phase === 'exploring'));
  $('dialogue').hidden = !available;
  if ($('conversation-panel').open && !available) $('conversation-panel').close();
  $('npc-title').textContent = `${NPC_NAMES[view.npc] ?? '인물'}에게 더 묻기`;
  const topics = view.topics ?? [];
  const makeTopic = (topic) =>
    button(
      topic.question ?? topic.label,
      () => act('TOPIC', { topicId: topic.id ?? topic.topicId }),
      undefined,
      `topic-${topic.id ?? topic.topicId}`
    );
  $('topics').replaceChildren(...topics.slice(0, 4).map(makeTopic));
  if (topics.length > 4) {
    const more = element('details');
    const group = element('div', undefined, 'topic-more');
    group.append(...topics.slice(4).map(makeTopic));
    more.append(element('summary', `다른 질문 ${topics.length - 4}개 더 보기 ＋`), group);
    $('topics').append(more);
  }
}
function renderChoices() {
  const panel = $('decision-panel');
  const list = $('choices');
  const wasOpen = panel.open;
  const previousScrollTop = panel.scrollTop;
  list.replaceChildren();
  if (view.phase !== 'choosing' || view.exploration?.puzzle) {
    panel.close();
    return;
  }
  const heading = element('div', undefined, 'decision-heading');
  const planning = view.sceneId === 'S01' && view.storyVersion === 'museum-map-4';
  const title = element('h2', planning ? '어디서부터 배를 찾을까요?' : '어떤 행동을 할까요?');
  title.id = 'decision-title';
  const intro = element('p', planning
    ? '발견한 흔적을 바탕으로 먼저 조사할 곳을 함께 정하세요. 확정 전에는 바꿀 수 있습니다.'
    : '행동을 고른 뒤 확정하세요. 확정 전에는 바꿀 수 있습니다.', 'choice-intro');
  intro.id = 'decision-intro';
  heading.append(element('p', '팀의 결정', 'eyebrow'), title, intro);
  const options = element('div', undefined, 'choice-options');
  const details = view.choices.map((choice) => choice.detail?.trim() ?? '');
  const sharedDetail =
    details.length > 1 && details.every(Boolean) && new Set(details).size === 1
      ? details[0]
      : null;
  if (sharedDetail) options.dataset.sharedDetail = 'true';
  list.append(heading);
  if (sharedDetail) list.append(element('p', sharedDetail, 'decision-context'));
  list.append(options);
  for (const choice of view.choices) {
    const item = button(
      '',
      () => {
        selected = choice.id;
        renderChoices();
        $('choices')
          .querySelector(`[data-choice="${choice.id}"]`)
          ?.focus({ preventScroll: true });
      },
      `choice ${selected === choice.id ? 'pending' : ''}`,
      `choice-${choice.id}`
    );
    item.dataset.choice = choice.id;
    item.setAttribute('aria-pressed', String(selected === choice.id));
    item.append(
      element('span', choice.id, 'letter'),
      element('span', choice.label, 'choice-label'),
      element('span', sharedDetail ? '' : choice.detail ?? '', 'detail')
    );
    if (selected === choice.id) {
      const mark = element('span', '✓', 'choice-selected-mark');
      mark.setAttribute('aria-hidden', 'true');
      item.append(mark);
    }
    options.append(item);
  }
  if (
    !choicesDismissed &&
    (!document.querySelector('dialog[open]') || $('decision-panel').open)
  )
    openPanel('decision-panel');
  if (selected) {
    const choice = view.choices.find((item) => item.id === selected);
    if (choice) {
      const confirmation = element('div', undefined, 'confirm-choice');
      confirmation.append(
        element('p', `${choice.id} · ${choice.label}`, 'confirm-choice-summary')
      );
      const actions = element('div', undefined, 'confirm-actions');
      actions.append(
        button(
          '선택 취소',
          () => {
            const previous = selected;
            selected = null;
            renderChoices();
            list.querySelector(`[data-choice="${previous}"]`)?.focus({ preventScroll: true });
          },
          'text-button'
        ),
        button(
          '이 행동으로 결정',
          () => act('CHOOSE', { choiceId: selected }),
          'primary',
          'confirm'
        )
      );
      confirmation.append(actions);
      list.append(confirmation);
    }
  } else {
    const prompt = element('div', undefined, 'confirm-choice confirm-choice-empty');
    prompt.append(element('p', '행동을 고르세요.', 'quiet'));
    const actions = element('div', undefined, 'confirm-actions');
    const confirm = button('이 행동으로 결정', () => {}, 'primary', 'confirm');
    confirm.disabled = true;
    confirm.dataset.unavailable = 'true';
    actions.append(confirm);
    prompt.append(actions);
    list.append(prompt);
  }
  if (panel.open) panel.scrollTop = wasOpen ? previousScrollTop : 0;
}
function render(sceneChanged = false, focusAction = null, followLatest = false) {
  if (renderedSession !== sessionId || renderedScene !== view.sceneId) pendingTalk = null;
  if (sceneChanged || renderedSession !== sessionId || renderedScene !== view.sceneId)
    $('objective-details').open = false;
  const arrival = $('arrival-note');
  if (view.phase === 'travelling') {
    lastTravel = view.travel;
    arrival.hidden = true;
    arrival.textContent = '';
  } else if (renderedPhase === 'travelling' && lastTravel && renderedSession === sessionId) {
    arrival.textContent = `${lastTravel.toLabel} 도착 · 조사를 시작합니다`;
    arrival.hidden = false;
  } else if (sceneChanged || followLatest) {
    arrival.hidden = true;
    arrival.textContent = '';
  }
  if (
    renderedSession !== sessionId ||
    renderedScene !== view.sceneId ||
    renderedCurrentMessage?.id !== (view.currentMessage ?? view.messages.at(-1))?.id
  )
    dialogueDismissed = false;
  const openingField =
    view.sceneId === 'O00' &&
    !view.exploration?.activeHotspot &&
    view.messages.length === 1 &&
    view.phase === 'exploring';
  document.body.dataset.mode = isMapMode()
    ? 'map'
    : view.exploration
    ? 'investigation'
    : 'story';
  document.body.dataset.phase = view.phase;
  const fieldVisible =
    !!view.exploration && dialogueDismissed && ['exploring', 'input'].includes(view.phase);
  document.querySelector('.dialogue-shell').hidden =
    fieldVisible || view.phase === 'travelling';
  $('chapter-label').textContent = `${view.teamId}팀 · ${
    view.chapter === 0 ? '마지막 초대 관람객' : `${view.chapter}장`
  }`;
  const beforeIncident =
    view.sceneId === 'O00' ||
    (view.sceneId === 'S01' &&
      !view.observations?.some((item) => item.sceneId === 'S01' && item.id === 'case') &&
      !view.exploration?.hotspots.some((item) => item.id === 'case' && item.visited));
  $('chapter-question').textContent = /^E[1-6]$/.test(view.sceneId)
    ? '우리 팀은 무엇을 남겼을까?'
    : beforeIncident
    ? '마지막 관람에서 무엇을 만나게 될까요?'
    : {
        1: '종이배는 어디로 사라졌을까?',
        2: '기록과 증언은 왜 서로 다를까?',
        3: '무엇을 지키고 어떤 책임을 남길까?',
      }[view.chapter] ?? '우리 팀은 무엇을 남겼을까?';
  const investigationSession =
    !!view.exploration && !['travelling', 'result', 'terminal'].includes(view.phase);
  $('progress-label').textContent =
    (view.phase === 'travelling'
      ? `목적지로 이동: ${view.travel.toLabel}. 방에 들어가면 다음 이야기가 시작됩니다.`
      : view.phase === 'result'
      ? view.canContinue
        ? continuationGuidance().objective
        : '선택의 결과를 확인하세요.'
      : investigationSession
      ? '현장을 자유롭게 둘러보세요.'
      : view.exploration?.objective) ??
    OBJECTIVES[view.sceneId] ??
    '우리 팀이 남긴 이 밤의 마지막 장면을 읽어 보세요.';
  $('scene-title').textContent =
    view.phase === 'travelling' ? `${view.travel.toLabel}로 가는 길` : view.title;
  $('objective-reason').textContent =
    investigationSession
      ? ''
      : view.phase === 'travelling'
      ? view.travel.reason ??
        view.nextScene?.reason ??
        (view.history?.at(-1)?.label
          ? `우리가 정한 행동: ${view.history.at(-1).label}`
          : '윤서가 안내한 장소로 걸어가 관람을 이어가세요.')
      : (view.phase === 'result' && view.canContinue
          ? view.nextScene?.reason
          : view.exploration?.reason) ?? '';
  $('objective-reason').hidden = !$('objective-reason').textContent;
  $('skip-intro').hidden = !view.canSkipIntro;
  if (view.phase === 'travelling')
    $('chapter-label').textContent = `${view.teamId}팀 · 박물관 이동`;
  $('scene-status').textContent = '';
  $('scene-status').hidden = true;
  // Closing while reading interrupts an investigation, never a committed result or ending.
  $('dialogue-close').hidden =
    !(view.phase === 'reading' && view.exploration?.activeHotspot);
  renderMessages(sceneChanged, followLatest);
  renderNotebook();
  $('hints').replaceChildren(
    element('p', '힌트를 읽어도 벌점은 없습니다.', 'quiet'),
    ...(view.hints ?? []).map((text, index) => element('p', `힌트 ${index + 1} · ${text}`))
  );
  if (view.canHint)
    $('hints').append(button('다음 힌트 펼치기', () => act('HINT'), undefined, 'hint-next'));
  renderControls();
  renderDialogue();
  renderChoices();
  investigation.update(view, { sessionId, busy, visible: fieldVisible });
  $('ending-actions').hidden = view.phase !== 'terminal';
  updateMuseum();
  renderNavigation();
  if (sceneChanged) {
    $('scene-title').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  } else if (focusAction) {
    const visible = (item) => item && !item.disabled && item.getClientRects().length > 0;
    const focus =
      [...document.querySelectorAll('[data-action]')].find(
        (item) => item.dataset.action === focusAction && visible(item)
      ) ??
      [
        ...document.querySelectorAll(
          '#reading-controls .primary, #investigation button, #choices button, #ending-actions button'
        ),
      ].find(visible);
    if (!document.querySelector('dialog[open]')) focus?.focus({ preventScroll: true });
  }
  setBusy(busy);
  renderedPhase = view.phase;
  if (view.phase === 'travelling' && !document.querySelector('dialog[open]')) focusFloor();
  if (openingField && sceneChanged)
    document.querySelector('#reading-controls [data-action="explore"]')?.focus({ preventScroll: true });
}
document.addEventListener(
  'click',
  (event) => {
    const control = event.target.closest('button');
    if (!busy || !control || control.dataset.close) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },
  true
);
for (const control of document.querySelectorAll('[data-close]'))
  control.addEventListener('click', () => {
    $(control.dataset.close).close();
    if (
      control.dataset.close === 'hint-panel' &&
      view?.phase === 'choosing' &&
      !choicesDismissed
    )
      openPanel('decision-panel');
  });
for (const panel of document.querySelectorAll('dialog'))
  panel.addEventListener('close', () => {
    if (panel.id === 'navigation-hud') {
      mapExpanded = false;
      panel.classList.remove('expanded');
      $('map-toggle').setAttribute('aria-expanded', 'false');
      renderNavigation();
      const target = mapReturnFocus;
      mapReturnFocus = null;
      const shouldRestoreFocus = restoreMapFocusOnClose;
      restoreMapFocusOnClose = true;
      if (
        shouldRestoreFocus &&
        !$('game').hidden &&
        !document.querySelector('dialog[open]')
      ) {
        const visible = target?.isConnected && target.getClientRects().length > 0;
        (visible ? target : $('map-toggle')).focus({ preventScroll: true });
      }
    } else if (
      ['history-panel', 'notebook-panel'].includes(panel.id) &&
      !document.querySelector('dialog[open]') &&
      !$('menu-toggle').hidden
    ) {
      $('menu-toggle').focus({ preventScroll: true });
    }
    pendingTalk = null;
    updateMuseum();
    renderCameraControls();
  });
$('navigation-hud').addEventListener('cancel', (event) => {
  event.preventDefault();
  toggleMap(false);
});
$('menu-toggle').addEventListener('click', () => openPanel('menu-panel'));
$('title-audio').addEventListener('click', () => openPanel('menu-panel'));
$('dialogue-close').addEventListener('click', returnToField);
$('help-toggle').addEventListener('click', () => openPanel('help-panel'));
$('title-help')?.addEventListener('click', () => openPanel('help-panel'));
$('start-game')?.addEventListener('click', async () => {
  if (invitationPending || busy) return;
  invitationPending = true;
  try {
    const teamId = await invitationIntro.open();
    if (teamId !== null && teamId !== undefined) await start(teamId, true);
  } catch (error) {
    notice(error.message ?? '초대장을 열지 못했습니다.');
  } finally {
    invitationIntro.close();
    invitationPending = false;
  }
});
$('continue-game')?.addEventListener('click', () => {
  const record = latestSessionRecord();
  if (record) start(record.teamId, false, record.sessionId);
});
$('skip-intro').addEventListener('click', async () => {
  if (await act('SKIP_INTRO')) closePanels();
});
$('map-toggle').addEventListener('click', () => toggleMap());
$('map-close').addEventListener('click', () => toggleMap(false));
$('camera-toggle').addEventListener('click', () => toggleCamera());
for (const [id, change] of [
  ['camera-zoom-in', { zoomFactor: 1.15 }],
  ['camera-zoom-out', { zoomFactor: 1 / 1.15 }],
  ['camera-left', { yawDelta: -15 }],
  ['camera-right', { yawDelta: 15 }],
  ['camera-up', { pitchDelta: 8 }],
  ['camera-down', { pitchDelta: -8 }],
])
  $(id).addEventListener('click', () => museum?.adjustCamera(change));
$('camera-reset').addEventListener('click', () => museum?.resetCamera());
window.addEventListener('resize', renderCameraControls);
$('notebook-toggle').addEventListener('click', () => openPanel('notebook-panel'));
$('history-toggle').addEventListener('click', () => openPanel('history-panel'));
async function leaveChoices() {
  choicesDismissed = true;
  $('decision-panel').close();
  if (view?.phase === 'choosing') await act('BACK');
}
$('decision-back').addEventListener('click', leaveChoices);
$('decision-panel').addEventListener('cancel', (event) => {
  event.preventDefault();
  leaveChoices();
});
$('teams-toggle').addEventListener('click', showTeams);
$('save-button').addEventListener('click', async () => {
  if (busy || !view) return;
  setBusy(true);
  try {
    const result = game.save(sessionId);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result.record, null, 2)], { type: 'application/json' })
    );
    const link = element('a');
    link.href = url;
    link.download = `박물관-${view.teamId}팀.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    sessionNotice(
      result,
      '기록 파일 저장을 요청했습니다. 브라우저의 다운로드를 확인해 주세요.'
    );
  } catch (error) {
    notice(error.message);
  } finally {
    setBusy(false);
  }
});
for (const id of ['restore-button', 'welcome-restore'])
  $(id).addEventListener('click', () => $('restore-file').click());
$('restore-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file || busy) return;
  pendingTalk = null;
  setBusy(true);
  const epoch = ++sessionEpoch;
  try {
    if (file.size > 2_000_000) throw new Error('2MB 이하의 게임 기록을 선택해 주세요.');
    const record = JSON.parse(await file.text());
    if (![1, 2, 3].includes(record?.teamId))
      throw new Error('팀 정보가 있는 게임 기록을 선택해 주세요.');
    if (epoch !== sessionEpoch) return;
    // Validate the entire record before adding a separate, resumable session.
    const result = game.restore(null, record);
    sessionId = result.sessionId;
    rememberSession(record.teamId, sessionId);
    view = result.view;
    navigation = null;
    selected = null;
    choicesDismissed = false;
    dialogueDismissed = false;
    showGame();
    sessionNotice(result, '기록을 불러왔습니다. 마지막으로 읽던 곳에서 이어갑니다.');
    render(true);
  } catch (error) {
    notice(
      error instanceof SyntaxError
        ? '기록 파일을 읽을 수 없습니다. 내려받은 원본 파일을 선택해 주세요.'
        : error.message
    );
  } finally {
    event.target.value = '';
    setBusy(false);
  }
});
$('new-game').addEventListener('click', () => start(view.teamId, true));
$('compare-button').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  try {
    const results = await Promise.allSettled(
      [1, 2, 3].map(async (id) => ({
        id,
        result: sessions[id] ? game.get(sessions[id]) : null,
      }))
    );
    $('comparison-teams').replaceChildren(
      ...results.map((result, index) => {
        const item = element('article');
        item.append(element('h2', `${index + 1}팀이 남긴 밤`));
        if (result.status === 'rejected') {
          item.append(element('p', result.reason.message));
          return item;
        }
        const team = result.value.result?.view;
        item.append(
          element('h3', team?.phase === 'terminal' ? team.title : '아직 끝나지 않은 이야기')
        );
        if (team?.phase === 'terminal') {
          const states = element('ul');
          states.append(
            ...Object.keys(STATUS).map((id) => element('li', STATUS[id][team.flags[id]]))
          );
          item.append(
            states,
            element('p', team.history.at(-1)?.label ?? '마지막 선택을 기록했습니다.')
          );
        } else
          item.append(
            element(
              'p',
              team
                ? `${team.history.length}번의 결정을 함께 내렸습니다. 결말은 이야기를 마친 뒤 나눌 수 있어요.`
                : '아직 이 팀의 이야기를 시작하지 않았습니다.'
            )
          );
        return item;
      })
    );
    $('game').hidden = true;
    $('comparison').hidden = false;
    document.body.dataset.screen = 'comparison';
    renderNavigation();
    window.scrollTo(0, 0);
    $('comparison').querySelector('h1').focus({ preventScroll: true });
  } finally {
    setBusy(false);
  }
});
$('comparison-back').addEventListener('click', () => {
  showGame();
  render();
  $('scene-title').focus({ preventScroll: true });
});
for (const input of document.querySelectorAll('[data-audio-volume]')) {
  const name = input.dataset.audioVolume;
  const output = document.querySelector(`[data-audio-value="${name}"]`);
  input.value = String(gameAudio.getSettings()[name]);
  output.value = `${input.value}%`;
  input.addEventListener('input', () => {
    gameAudio.setVolume(name, input.value);
    output.value = `${input.value}%`;
  });
}
function playUiFeedback(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const action = button.dataset.sound ?? button.dataset.action;
  gameAudio.play(['confirm', 'next', 'continue'].includes(action) ? 'confirm' : 'click');
}
document.addEventListener('pointerdown', (event) => {
  gameAudio.unlock();
  if (!event.target.closest('button')?.disabled) playUiFeedback(event);
}, true);
document.addEventListener('click', (event) => {
  // Keyboard activation has no pointerdown; pointer clicks already sounded at pointerdown.
  if (event.detail !== 0) return;
  gameAudio.unlock();
  playUiFeedback(event);
});
document.addEventListener('visibilitychange', () => {
  updateMuseum();
});
document.addEventListener('keydown', (event) => {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    busy ||
    $('game').hidden
  )
    return;
  if (isMapMode() && $('navigation-hud').open && event.key.toLowerCase() === 'm') {
    event.preventDefault();
    gameAudio.play('click');
    toggleMap(false);
    return;
  }
  if (document.querySelector('dialog[open]')) return;
  if (event.target.closest('input, textarea, select, [contenteditable]')) return;
  if (event.key === 'Escape' && investigationPanelOpen) {
    event.preventDefault();
    investigation.closePanel();
    return;
  }
  if (event.key === 'Escape' && cameraExpanded) {
    event.preventDefault();
    toggleCamera(false);
    return;
  }
  const objectiveDetails = $('objective-details');
  if (event.key === 'Escape' && objectiveDetails.open) {
    event.preventDefault();
    objectiveDetails.open = false;
    objectiveDetails.querySelector('summary')?.focus({ preventScroll: true });
    return;
  }
  if (event.key === 'Escape' && canReturnToField()) {
    event.preventDefault();
    returnToField();
    return;
  }
  if (isMapMode() && event.key.toLowerCase() === 'm') {
    event.preventDefault();
    gameAudio.play('click');
    toggleMap();
    return;
  }
  if (event.target.closest('input, textarea, select, button, a, summary, #current-message')) return;
  if (
    view?.canNext &&
    (event.key === 'Enter' || event.key === ' ') &&
    !document.querySelector('.dialogue-shell').hidden &&
    document.querySelector('.dialogue-shell').getClientRects().length > 0
  ) {
    event.preventDefault();
    gameAudio.play('confirm');
    act('NEXT');
    return;
  }
  if (!isMapMode() && event.key === 'ArrowRight' && view?.canNext) {
    event.preventDefault();
    gameAudio.play('confirm');
    act('NEXT');
  }
});
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) museum?.dispose();
});
teamButtons();
setBusy(false);
