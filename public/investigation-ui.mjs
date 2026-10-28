const SYMBOLS = {
  leaf: '❧',
  wave: '≋',
  star: '✦',
  shut: '⊣',
  brace: '╪',
  lift: '↑',
  power: '⏻',
};

function pieceSymbol(id) {
  const item = element('span', id === 'bell' ? undefined : SYMBOLS[id] ?? '◇', 'piece-symbol');
  item.setAttribute('aria-hidden', 'true');
  if (id !== 'bell') return item;
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '29');
  svg.setAttribute('height', '29');
  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('d', 'M12 3v2M5 18h14l-2-3V10a5 5 0 0 0-10 0v5l-2 3Zm5 3h4');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  svg.append(path);
  item.append(svg);
  return item;
}

function element(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}

function button(label, action, className = '', id = '') {
  const item = element('button', label, className);
  item.type = 'button';
  if (id) {
    item.dataset.investigationAction = id;
    item.dataset.action = id;
  }
  item.addEventListener('click', action);
  return item;
}

function unavailable(control, value) {
  control.disabled = value;
  control.dataset.unavailable = String(value);
  return control;
}

/** Local drafts never judge answers or change game state; only confirmed events reach act. */
export function mountInvestigation(
  root,
  { act, onTalk, onChoices, npcName, onPanelChange, onHelp }
) {
  let view;
  let identity = null;
  let panel = null;
  let answer = [];
  let confirming = false;
  let deduction = null;
  let busy = false;
  let visible = false;
  let reportedPanel = false;
  let objectsExpanded = false;

  function redraw(focusId = null) {
    const scrollTop =
      root.dataset.panel === panel
        ? root.querySelector('.investigation-panel')?.scrollTop ?? 0
        : 0;
    render();
    const opened = visible && panel !== null;
    if (opened !== reportedPanel) {
      reportedPanel = opened;
      onPanelChange?.(opened);
    }
    const sheet = root.querySelector('.investigation-panel');
    if (sheet) sheet.scrollTop = scrollTop;
    if (focusId)
      [...root.querySelectorAll('[data-investigation-action]')]
        .find((item) => item.dataset.investigationAction === focusId)
        ?.focus({ preventScroll: true });
  }

  function showPanel(next) {
    panel = panel === next ? null : next;
    confirming = false;
    redraw(panel ? 'close-panel' : `open-${next}`);
  }

  function edit(next, focusId) {
    answer = next;
    confirming = false;
    redraw(focusId);
  }

  function performPrimaryAction() {
    const primary = view.exploration?.primaryAction;
    if (!primary || busy) return;
    if (primary.kind === 'deduce') {
      showPanel('notes');
      const deductionArea = root.querySelector('.deduction-area');
      const prompt = deductionArea?.querySelector('h3');
      if (prompt) {
        prompt.tabIndex = -1;
        prompt.focus({ preventScroll: true });
      }
      deductionArea?.scrollIntoView({ block: 'start', behavior: 'instant' });
      return;
    }
    if (primary.kind === 'puzzle') {
      showPanel('puzzle');
      return;
    }
    if (primary.kind === 'choices') {
      onChoices();
      return;
    }
    if (primary.kind === 'continue') {
      act('CONTINUE');
      return;
    }
    if (primary.kind === 'inspect') {
      act('INSPECT', { hotspotId: primary.hotspotId });
      return;
    }
    throw new Error(
      `Unknown primary action ${primary.kind}; use a supported investigation action.`
    );
  }

  function notes(exploration) {
    const container = element('div', undefined, 'field-notes');
    container.append(
      element(
        'p',
        '직접 본 흔적을 나란히 놓아 보세요. 보존한 자료와 장비는 기록장에서 따로 확인할 수 있습니다.',
        'quiet'
      )
    );
    const observations = element('div', undefined, 'observation-cards');
    for (const observation of exploration.observations) {
      const card = element('article', undefined, 'observation-card');
      card.append(element('h3', observation.label), element('p', observation.text));
      observations.append(card);
    }
    if (!exploration.observations.length)
      observations.append(
        element(
          'p',
          '아직 살펴본 흔적이 없습니다. 장면 속 사물을 눌러 보세요.',
          'empty-observations'
        )
      );
    container.append(observations);
    const puzzle = exploration.deduction;
    if (!puzzle) return container;
    const ready = puzzle.requires.every((id) =>
      exploration.hotspots.some((hotspot) => hotspot.id === id && hotspot.visited)
    );
    const deductionArea = element('section', undefined, 'deduction-area');
    deductionArea.append(element('p', '단서 대조', 'eyebrow'));
    if (!ready) {
      deductionArea.append(
        element('p', '아직 대조할 관찰이 부족합니다. 표시된 사물을 끝까지 살펴보세요.', 'quiet')
      );
    } else if (exploration.deductionSolved) {
      deductionArea.append(
        element('p', '흔적 사이의 관계를 확인했습니다.', 'deduction-complete')
      );
    } else {
      deductionArea.append(element('h3', puzzle.prompt));
      for (const option of puzzle.options) {
        const control = button(
          option.label,
          () => {
            deduction = option.id;
            redraw(`deduce-${option.id}`);
          },
          'deduction-option',
          `deduce-${option.id}`
        );
        control.setAttribute('aria-pressed', String(deduction === option.id));
        deductionArea.append(control);
      }
      deductionArea.append(
        unavailable(
          button(
            '이 해석으로 대조하기',
            () => act('DEDUCE', { answerId: deduction }),
            'primary',
            'deduce-submit'
          ),
          !deduction
        )
      );
    }
    if (exploration.feedback) {
      const feedback = element('p', exploration.feedback, 'deduction-feedback');
      feedback.setAttribute('role', 'status');
      deductionArea.append(feedback);
    }
    container.append(deductionArea);
    return container;
  }

  function orderBoard(puzzle) {
    const board = element(
      'div',
      undefined,
      `order-board ${view.sceneId === 'P11' ? 'stamp-board' : 'control-board'}`
    );
    const slots = element('ol', undefined, 'order-slots');
    for (let index = 0; index < puzzle.pieces.length; index += 1) {
      const id = answer[index];
      const piece = puzzle.pieces.find((item) => item.id === id);
      const slot = element('li', undefined, `order-slot ${piece ? 'filled' : ''}`);
      slot.append(element('span', `${index + 1}`, 'slot-number'));
      if (!piece) {
        slot.append(element('span', '놓을 자리', 'empty-slot'));
      } else {
        slot.append(pieceSymbol(id), element('strong', piece.label));
        const moves = element('div', undefined, 'piece-moves');
        const move = (direction) => {
          const next = [...answer];
          [next[index], next[index + direction]] = [next[index + direction], next[index]];
          edit(next, `remove-${id}`);
        };
        const previous = unavailable(
          button('←', () => move(-1), '', `previous-${id}`),
          index === 0
        );
        previous.setAttribute('aria-label', `${piece.label} 앞자리로 옮기기`);
        const remove = button(
          '빼기',
          () =>
            edit(
              answer.filter((value) => value !== id),
              `piece-${id}`
            ),
          '',
          `remove-${id}`
        );
        remove.setAttribute('aria-label', `${piece.label} 순서에서 빼기`);
        const next = unavailable(
          button('→', () => move(1), '', `next-${id}`),
          index === answer.length - 1
        );
        next.setAttribute('aria-label', `${piece.label} 뒷자리로 옮기기`);
        moves.append(previous, remove, next);
        slot.append(moves);
      }
      slots.append(slot);
    }
    const bank = element('div', undefined, 'piece-bank');
    // The bank is unplaced material, not a suggested solution order.
    const pieces = [...puzzle.pieces.slice(2), ...puzzle.pieces.slice(0, 2)];
    for (const piece of pieces) {
      const control = button(
        '',
        () => edit([...answer, piece.id], `remove-${piece.id}`),
        'puzzle-piece',
        `piece-${piece.id}`
      );
      control.append(pieceSymbol(piece.id), element('span', piece.label));
      control.setAttribute('aria-label', `${piece.label} 다음 자리에 놓기`);
      bank.append(unavailable(control, answer.includes(piece.id)));
    }
    board.append(
      slots,
      element(
        'p',
        '아래 조각을 누르면 다음 빈자리에 놓입니다. 놓은 조각은 화살표로 옮기거나 뺄 수 있어요.',
        'quiet'
      ),
      bank
    );
    return board;
  }

  function pathBoard(puzzle) {
    const board = element('div', undefined, 'path-board');
    const map = element('div', undefined, 'route-map');
    map.setAttribute('aria-label', '박물관 통로 지도');
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const definitions = document.createElementNS(namespace, 'defs');
    const marker = document.createElementNS(namespace, 'marker');
    marker.setAttribute('id', 'route-arrow');
    marker.setAttribute('markerWidth', '4');
    marker.setAttribute('markerHeight', '4');
    marker.setAttribute('refX', '3.5');
    marker.setAttribute('refY', '2');
    marker.setAttribute('orient', 'auto');
    const arrow = document.createElementNS(namespace, 'path');
    arrow.setAttribute('d', 'M0 0L4 2L0 4Z');
    marker.append(arrow);
    definitions.append(marker);
    svg.append(definitions);
    for (const edge of puzzle.edges ?? []) {
      const from = puzzle.nodes.find((node) => node.id === edge.from);
      const to = puzzle.nodes.find((node) => node.id === edge.to);
      if (!from || !to) continue;
      const line = document.createElementNS(namespace, 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
      line.setAttribute('class', `map-edge${edge.blocked ? ' blocked' : ''}`);
      line.setAttribute('marker-end', 'url(#route-arrow)');
      svg.append(line);
      const cost = element(
        'span',
        `${edge.cost}${edge.blocked ? ' · 침수' : ''}`,
        `edge-cost${edge.blocked ? ' blocked' : ''}`
      );
      cost.style.left = `${(from.x + to.x) / 2}%`;
      cost.style.top = `${(from.y + to.y) / 2}%`;
      map.append(cost);
    }
    const route = document.createElementNS(namespace, 'polyline');
    route.setAttribute(
      'points',
      answer
        .map((id) => puzzle.nodes.find((node) => node.id === id))
        .filter(Boolean)
        .map((node) => `${node.x},${node.y}`)
        .join(' ')
    );
    route.setAttribute('class', 'drawn-route');
    svg.append(route);
    map.prepend(svg);
    const last = answer.at(-1);
    for (const node of puzzle.nodes) {
      const index = answer.indexOf(node.id);
      const connected =
        last !== 'return' &&
        (puzzle.edges ?? []).some((edge) => edge.from === last && edge.to === node.id);
      const control = button(
        node.label,
        () =>
          edit(
            index >= 0 ? answer.slice(0, index + 1) : [...answer, node.id],
            `node-${node.id}`
          ),
        `map-node${index >= 0 ? ' on-route' : ''}`,
        `node-${node.id}`
      );
      control.style.left = `${node.x}%`;
      control.style.top = `${node.y}%`;
      control.setAttribute(
        'aria-label',
        index >= 0 ? `${node.label}까지 경로 되돌리기` : `${node.label}로 이어 그리기`
      );
      control.setAttribute('aria-pressed', String(index >= 0));
      map.append(unavailable(control, index < 0 && !connected));
    }
    const labels = answer.map((id) => puzzle.nodes.find((node) => node.id === id)?.label ?? id);
    const summary = element('p', labels.join(' → '), 'route-summary');
    summary.setAttribute('aria-live', 'polite');
    board.append(
      map,
      summary,
      element(
        'p',
        '화살표로 이어진 장소를 눌러 경로를 그리세요. 이미 지난 장소를 누르면 거기까지 되돌아갑니다.',
        'quiet'
      )
    );
    return board;
  }

  function workbench(exploration) {
    const puzzle = exploration.puzzle;
    const container = element('div', undefined, 'puzzle-workbench');
    container.append(element('h3', puzzle.title));
    const clues = element('div', undefined, 'puzzle-instructions');
    for (const text of puzzle.instructions) clues.append(element('p', text));
    if (!puzzle.instructions.length)
      clues.append(
        element('p', '주변 안내와 장치를 먼저 조사하면 조작에 필요한 기록이 여기에 남습니다.')
      );
    container.append(clues, puzzle.kind === 'path' ? pathBoard(puzzle) : orderBoard(puzzle));
    const complete =
      puzzle.kind === 'path'
        ? answer[0] === 'entrance' && answer.at(-1) === 'return'
        : answer.length === puzzle.pieces.length;
    const actions = element('div', undefined, 'workbench-actions');
    actions.append(
      button(
        '처음부터 놓기',
        () => edit(puzzle.kind === 'path' ? ['entrance'] : [], 'puzzle-reset'),
        'text-button',
        'puzzle-reset'
      )
    );
    if (view.canHint)
      actions.append(
        button('힌트 한 장 보기', () => act('HINT'), 'quiet-button', 'puzzle-hint')
      );
    if (!confirming)
      actions.append(
        unavailable(
          button(
            '이 답 검토하기',
            () => {
              confirming = true;
              redraw('puzzle-submit');
              root
                .querySelector('.puzzle-confirmation')
                ?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
            },
            'primary',
            'puzzle-review'
          ),
          !complete || !exploration.canChoose
        )
      );
    container.append(actions);
    if (!exploration.canChoose)
      container.append(
        element(
          'p',
          exploration.blockedReason ?? '필요한 관찰을 마친 뒤 답을 확정할 수 있습니다.',
          'quiet'
        )
      );
    for (const [index, text] of (view.hints ?? []).entries())
      container.append(element('p', `힌트 ${index + 1} · ${text}`, 'puzzle-hint'));
    if (confirming) {
      const confirmation = element('section', undefined, 'puzzle-confirmation');
      const pieces = puzzle.kind === 'path' ? puzzle.nodes : puzzle.pieces;
      confirmation.append(
        element('h4', '우리 팀의 최종 답'),
        element(
          'p',
          answer.map((id) => pieces.find((piece) => piece.id === id)?.label ?? id).join(' → ')
        ),
        element(
          'p',
          '확정하면 이 답의 결과로 이야기가 이어집니다. 제출 전에는 순서를 다시 고칠 수 있어요.',
          'quiet'
        )
      );
      const controls = element('div', undefined, 'confirm-actions');
      controls.append(
        button(
          '다시 고치기',
          () => {
            confirming = false;
            redraw('puzzle-review');
          },
          'text-button'
        ),
        unavailable(
          button(
            '이 답으로 확정',
            async () => {
              if (busy) return;
              const accepted = await act('SOLVE', { answer: [...answer] });
              if (accepted) {
                panel = null;
                confirming = false;
                redraw();
              }
            },
            'primary',
            'puzzle-submit'
          ),
          false
        )
      );
      confirmation.append(controls);
      container.append(confirmation);
    }
    return container;
  }

  function render() {
    root.replaceChildren();
    root.dataset.panel = panel ?? '';
    const exploration = view?.exploration;
    const interactive = visible && !!exploration && ['exploring', 'input'].includes(view.phase);
    root.hidden = !interactive;
    if (!interactive) return;
    const dock = element('div', undefined, 'investigation-dock');
    const primary = exploration.primaryAction;
    const label = element('div', undefined, 'investigation-label');
    label.append(
      element('span', '지금 할 일', 'eyebrow'),
      element('span', `관찰 기록 ${exploration.observations.length}개`, 'inspection-count')
    );
    const objects = element('div', undefined, 'hotspot-list');
    objects.setAttribute('aria-label', '조사할 사물');
    for (const hotspot of exploration.hotspots) {
      if (primary?.kind === 'inspect' && hotspot.id === primary.hotspotId) continue;
      const control = button(
        '',
        () => {
          panel = null;
          redraw();
          act('INSPECT', { hotspotId: hotspot.id });
        },
        `hotspot-tab${hotspot.visited ? ' visited' : ''}`,
        `inspect-${hotspot.id}`
      );
      control.append(
        element('span', hotspot.visited ? '✓' : '＋', 'hotspot-mark'),
        element('span', hotspot.label)
      );
      control.setAttribute(
        'aria-label',
        `${hotspot.label} ${hotspot.visited ? '다시 살펴보기' : '조사하기'}`
      );
      control.setAttribute('aria-current', String(exploration.activeHotspot === hotspot.id));
      objects.append(control);
    }
    const actions = element('div', undefined, 'investigation-actions');
    dock.append(label);
    if (primary && !panel) {
      dock.append(
        button(primary.label, performPrimaryAction, 'primary field-primary', 'field-primary')
      );
    }
    const notesButton = button(
      '관찰 기록',
      () => showPanel('notes'),
      panel === 'notes' ? 'selected-tool' : '',
      'open-notes'
    );
    notesButton.setAttribute('aria-expanded', String(panel === 'notes'));
    actions.append(notesButton);
    if (view.npc)
      actions.append(
        button(
          `${npcName(view.npc)}에게 묻기`,
          () => {
            panel = null;
            redraw();
            onTalk();
          },
          '',
          'field-talk'
        )
      );
    if (!primary && exploration.puzzle) {
      const control = button(
        exploration.puzzle.kind === 'path'
          ? '지도에 경로 그리기'
          : view.sceneId === 'P11'
          ? '도장 놓기'
          : '장치 순서 조작',
        () => showPanel('puzzle'),
        'primary',
        'open-puzzle'
      );
      control.setAttribute('aria-expanded', String(panel === 'puzzle'));
      actions.append(control);
    } else if (!primary) {
      actions.append(
        unavailable(
          button(
            exploration.canChoose ? '다음 행동 정하기 →' : '조사를 마쳐 주세요',
            onChoices,
            'primary',
            'field-choices'
          ),
          !exploration.canChoose
        )
      );
    }
    if (onHelp) actions.append(button('조작 방법', onHelp, 'text-button', 'field-help'));
    dock.append(actions);
    if (objects.childElementCount) {
      const otherObjects = element('details', undefined, 'other-observations');
      otherObjects.open = objectsExpanded;
      otherObjects.addEventListener('toggle', () => {
        objectsExpanded = otherObjects.open;
      });
      otherObjects.append(
        element('summary', `다른 대상 살펴보기 · ${objects.childElementCount}`),
        objects
      );
      dock.append(otherObjects);
    }
    const help = element('p', undefined, 'field-help');
    help.append(
      element(
        'span',
        '바닥 클릭 / WASD 이동 · 가까이에서 E 조사 · M 지도',
        'keyboard-controls'
      ),
      element('span', '바닥 탭으로 이동 · 가까운 사물을 탭해서 조사', 'touch-controls')
    );
    dock.append(help);
    if (!primary && !exploration.canChoose)
      dock.append(
        element(
          'p',
          exploration.blockedReason ?? '주변 사물을 살펴보세요.',
          'investigation-status'
        )
      );
    else if (!primary && !exploration.puzzle)
      dock.append(
        element(
          'p',
          '확인한 흔적을 바탕으로 이제 행동을 정할 수 있습니다.',
          'investigation-status'
        )
      );
    root.append(dock);
    if (!panel) return;
    const sheet = element('section', undefined, 'investigation-panel');
    sheet.setAttribute('aria-label', panel === 'notes' ? '관찰과 추리' : '퍼즐 조작');
    const heading = element('div', undefined, 'panel-heading');
    heading.append(
      element('h2', panel === 'notes' ? '흔적을 맞춰 보기' : '직접 조작하기'),
      button('현장으로', () => showPanel(panel), 'text-button', 'close-panel')
    );
    sheet.append(heading, panel === 'notes' ? notes(exploration) : workbench(exploration));
    root.append(sheet);
  }

  return {
    performPrimaryAction,
    setBusy(pending) {
      busy = pending;
    },
    update(next, { sessionId, busy: pending, visible: shown }) {
      const focusId = root.contains(document.activeElement)
        ? document.activeElement.dataset.investigationAction
        : null;
      const nextIdentity = `${sessionId}:${next.sceneId}`;
      if (identity !== nextIdentity) {
        identity = nextIdentity;
        panel = null;
        confirming = false;
        deduction = null;
        objectsExpanded = false;
        answer = next.exploration?.puzzle?.kind === 'path' ? ['entrance'] : [];
      }
      view = next;
      if (view.exploration?.puzzle?.kind === 'path' && !answer.length) answer = ['entrance'];
      busy = pending;
      visible = shown;
      if (!['exploring', 'input'].includes(view.phase)) panel = null;
      redraw(focusId);
    },
  };
}
