const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function icon(pathData, extra = []) {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const data of [pathData, ...extra]) {
    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    path.setAttribute('d', data);
    svg.append(path);
  }
  return svg;
}

/** Mount a brief invitation sequence. The caller owns when the resolved team starts. */
export function mountInvitationIntro(dialog, { message, recipient }) {
  if (!(dialog instanceof HTMLDialogElement))
    throw new TypeError('mountInvitationIntro requires a native dialog element.');

  let phase = 'closed';
  let runId = 0;
  let currentPromise = null;
  let resolvePending = null;
  const pendingWaits = new Set();

  const closeButton = element('button', '타이틀로', 'invitation-close');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', '초대장을 닫고 타이틀 화면으로 돌아가기');
  closeButton.title = '타이틀로';
  closeButton.append(icon('M18 6 6 18M6 6l12 12'));

  const stage = element('section', undefined, 'invitation-stage');
  stage.setAttribute('aria-label', '마지막 관람 초대장');

  const envelope = element('div', undefined, 'invitation-envelope');
  envelope.setAttribute('aria-hidden', 'true');
  const envelopeBack = element('div', undefined, 'envelope-back');
  const envelopePocket = element('div', undefined, 'envelope-pocket');
  const envelopeFront = element('div', undefined, 'envelope-front');
  const flap = element('div', undefined, 'envelope-flap');
  const seal = element('div', 'Y', 'envelope-seal');
  envelope.append(envelopeBack, envelopePocket, envelopeFront, flap, seal);

  const letter = element('article', undefined, 'invitation-paper');
  letter.setAttribute('aria-label', '윤서 관장의 초대장');
  letter.setAttribute('aria-hidden', 'true');
  letter.inert = true;
  const letterReading = element('div', undefined, 'invitation-letter-reading');
  letterReading.append(
    element('p', '마지막 관람 초대장', 'invitation-letter-label'),
    element('p', `받는 분 · ${recipient}`, 'invitation-recipient'),
    element('p', String(message ?? ''), 'invitation-message'),
    element('p', '관장 윤서', 'invitation-signature')
  );
  const enterButton = element('button', '함께 입장하기', 'invitation-enter');
  enterButton.type = 'button';
  letterReading.append(enterButton);

  const teamStage = element('section', undefined, 'invitation-team-stage');
  teamStage.hidden = true;
  teamStage.setAttribute('aria-labelledby', 'invitation-team-title');
  const teamTitle = element('h2', '어느 팀으로 입장할까요?');
  teamTitle.id = 'invitation-team-title';
  teamTitle.tabIndex = -1;
  const teamDescription = element('p', '같은 팀은 하나의 진행 기록을 함께 이어갑니다.');
  const teamBack = element('button', '초대장 다시 읽기', 'invitation-back');
  teamBack.type = 'button';
  const teamButtons = element('div', undefined, 'invitation-team-buttons');
  const teamControls = [1, 2, 3].map((teamId) => {
    const control = element('button', `${teamId}팀`, 'invitation-team-choice');
    control.type = 'button';
    control.addEventListener('click', () => chooseTeam(teamId));
    teamButtons.append(control);
    return control;
  });
  teamStage.append(teamTitle, teamDescription, teamButtons, teamBack);
  letter.append(letterReading, teamStage);

  const openButton = element('button', undefined, 'invitation-open');
  openButton.type = 'button';
  openButton.disabled = true;
  openButton.dataset.unavailable = 'true';
  openButton.setAttribute('aria-label', `초대장 열기 · 받는 분 ${recipient}`);
  openButton.append(
    element('span', '초대장 열기', 'invitation-open-label'),
    element('span', recipient, 'invitation-open-recipient')
  );

  stage.append(envelope, openButton, letter);
  dialog.replaceChildren(closeButton, stage);

  function resolve(value) {
    if (!resolvePending) return;
    const settle = resolvePending;
    resolvePending = null;
    settle(value);
  }

  function wait(duration, expectedRun) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return Promise.resolve(expectedRun === runId);
    return new Promise((done) => {
      let timer;
      const cancel = () => {
        window.clearTimeout(timer);
        pendingWaits.delete(cancel);
        done(false);
      };
      timer = window.setTimeout(() => {
        pendingWaits.delete(cancel);
        done(expectedRun === runId);
      }, duration);
      pendingWaits.add(cancel);
    });
  }

  function cancelWaits() {
    for (const cancel of [...pendingWaits]) cancel();
  }

  function reset() {
    runId += 1;
    cancelWaits();
    phase = 'closed';
    dialog.removeAttribute('aria-busy');
    dialog.classList.remove('is-entering-game');
    stage.classList.remove('paper-rising');
    envelope.classList.remove('has-arrived', 'flap-open', 'seal-hidden', 'paper-rising');
    openButton.disabled = false;
    openButton.dataset.unavailable = 'false';
    openButton.hidden = false;
    letter.hidden = false;
    letter.inert = true;
    letter.setAttribute('aria-hidden', 'true');
    letterReading.hidden = false;
    teamStage.hidden = true;
    teamTitle.textContent = '어느 팀으로 입장할까요?';
    for (const control of [closeButton, enterButton, teamBack, ...teamControls]) {
      control.disabled = false;
      control.dataset.unavailable = 'false';
    }
    currentPromise = null;
  }

  async function arrive(expectedRun) {
    await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
    if (expectedRun !== runId || phase !== 'arrival') return;
    envelope.classList.add('has-arrived');
    if (!(await wait(820, expectedRun)) || phase !== 'arrival') return;
    phase = 'sealed';
    openButton.disabled = false;
    openButton.dataset.unavailable = 'false';
    openButton.focus({ preventScroll: true });
  }

  async function openLetter() {
    if (phase !== 'sealed') return;
    phase = 'opening';
    const expectedRun = runId;
    openButton.disabled = true;
    envelope.classList.add('flap-open');
    if (!(await wait(210, expectedRun)) || phase !== 'opening') return;
    envelope.classList.add('seal-hidden');
    if (!(await wait(110, expectedRun)) || phase !== 'opening') return;
    letter.inert = false;
    letter.removeAttribute('aria-hidden');
    stage.classList.add('paper-rising');
    if (!(await wait(360, expectedRun)) || phase !== 'opening') return;
    phase = 'reading';
    openButton.hidden = true;
    enterButton.focus({ preventScroll: true });
  }

  function showTeamSelection() {
    if (phase !== 'reading') return;
    phase = 'team-selection';
    letterReading.hidden = true;
    teamStage.hidden = false;
    teamTitle.focus({ preventScroll: true });
  }

  function returnToLetter() {
    if (phase !== 'team-selection') return;
    phase = 'reading';
    teamStage.hidden = true;
    letterReading.hidden = false;
    enterButton.focus({ preventScroll: true });
  }

  function chooseTeam(teamId) {
    if (phase !== 'team-selection') return;
    phase = 'entering-game';
    dialog.classList.add('is-entering-game');
    dialog.setAttribute('aria-busy', 'true');
    for (const control of [closeButton, enterButton, teamBack, ...teamControls]) {
      control.disabled = true;
      control.dataset.unavailable = 'true';
    }
    teamTitle.textContent = `${teamId}팀과 입장합니다`;
    teamTitle.focus({ preventScroll: true });
    resolve(teamId);
  }

  function close() {
    if (phase !== 'entering-game') resolve(null);
    if (dialog.open) dialog.close();
    reset();
  }

  closeButton.addEventListener('click', () => {
    if (phase !== 'entering-game') close();
  });
  openButton.addEventListener('click', openLetter);
  enterButton.addEventListener('click', showTeamSelection);
  teamBack.addEventListener('click', returnToLetter);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (phase !== 'entering-game') close();
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    if (phase !== 'entering-game') resolve(null);
    reset();
  });

  return {
    open() {
      if (dialog.open) return currentPromise ?? Promise.resolve(null);
      if (typeof dialog.showModal !== 'function') return Promise.resolve(null);
      reset();
      phase = 'arrival';
      openButton.disabled = true;
      openButton.dataset.unavailable = 'true';
      const expectedRun = runId;
      currentPromise = new Promise((done) => {
        resolvePending = done;
      });
      dialog.showModal();
      void arrive(expectedRun);
      return currentPromise;
    },
    close,
  };
}
