() => {
  const rows = [];
  const answers = { S01: 'trace', T21: 'after', D21: 'change', S22: 'tomorrow' };
  const boards = {
    P11: {
      A: ['bell', 'leaf', 'wave', 'star'],
      B: ['wave', 'star', 'bell', 'leaf'],
      C: ['star', 'bell', 'leaf', 'wave'],
      D: ['bell', 'wave', 'leaf', 'star'],
    },
    P12: {
      A: ['archive', 'return'],
      B: ['pump', 'return'],
      C: ['garden', 'return'],
      D: ['office', 'archive', 'return'],
    },
    P21: {
      A: ['brace', 'shut', 'lift', 'power'],
      B: ['shut', 'brace', 'lift', 'power'],
      C: ['shut', 'power', 'brace', 'lift'],
      D: ['shut', 'lift', 'brace', 'power'],
    },
  };
  const visible = (node) =>
    !!node &&
    node.getClientRects().length > 0 &&
    getComputedStyle(node).visibility !== 'hidden';
  function until(predicate, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      let timer;
      const observer = new MutationObserver(check);
      function check() {
        if (!predicate()) return;
        observer.disconnect();
        clearTimeout(timer);
        resolve();
      }
      observer.observe(document.body, { subtree: true, childList: true, attributes: true });
      timer = setTimeout(() => {
        observer.disconnect();
        reject(
          new Error(`UI did not settle: ${window.qaView?.sceneId}/${window.qaView?.phase}`)
        );
      }, timeoutMs);
      check();
    });
  }
  async function click(action, changesState = false) {
    if(window.qaCheckpoint)await window.qaCheckpoint(action);
    const node = [...document.querySelectorAll(`[data-action="${action}"]`)].find(visible);
    if ((!node || !visible(node)) && window.qaWorldAction &&
        (action.startsWith('inspect-') || ['field-primary','field-choices','open-puzzle','continue'].includes(action))) {
      await field();
      await window.qaWorldAction(action.startsWith('inspect-') ? action.slice(8) : action === 'field-primary' && window.qaView.exploration?.primaryAction?.kind === 'inspect' ? window.qaView.exploration.primaryAction.hotspotId : 'field-action');
      return window.qaView;
    }
    if (!node || node.disabled || node.getAttribute('aria-disabled') === 'true')
      throw new Error(
        `Action ${action} is unavailable in ${window.qaView?.sceneId}/${window.qaView?.phase}`
      );
    const revision = window.qaView?.revision;
    node.click();
    if (changesState)
      await until(
        () =>
          window.qaView?.revision > revision &&
          document.getElementById('game').getAttribute('aria-busy') === 'false'
      );
    return window.qaView;
  }
  async function read() {
    for (let i = 0; i < 80 && window.qaView?.canNext; i++) await click('next', true);
    if (window.qaView?.canNext) throw new Error('Message segment exceeded 80 steps');
  }
  async function field() {
    if (window.qaView?.phase === 'travelling' && window.qaTravel) await window.qaTravel();
    await read();
    if (visible(document.querySelector('[data-action="explore"]')))
      await click('explore', true);
  }
  // Regression: ../artifacts/final-evidence.md#onboarding-1 — advance without an EXPLORE detour.
  async function continueInspection() {
    const exploration = window.qaView.exploration;
    const previous = exploration.hotspots.find((item) => item.id === exploration.activeHotspot);
    const next = exploration.primaryAction;
    if (!previous?.visited || next?.kind !== 'inspect' || next.hotspotId === previous.id)
      throw new Error('Finish an inspection with another inspection as the primary action.');
    await click('field-primary', true);
    if (window.qaView.exploration.activeHotspot !== next.hotspotId)
      throw new Error(`Expected inspection ${next.hotspotId} after ${previous.id}.`);
    return { from: previous.id, to: next.hotspotId };
  }
  async function restart() {
    const control = document.getElementById('new-game');
    if (!visible(control))
      throw new Error('Reach an ending before checking a new playthrough.');
    control.click();
    await until(
      () =>
        window.qaView.sceneId === 'O00' &&
        document.getElementById('game').getAttribute('aria-busy') === 'false'
    );
    const avatar = window.museumDiagnostics().avatar;
    if (avatar.roomId !== 'foyer' || Math.hypot(avatar.x, avatar.z - 19) > 0.01)
      throw new Error(
        `A new story retained the previous avatar position: ${JSON.stringify(avatar)}`
      );
    return avatar;
  }
  // Regression: ../artifacts/full-play-review.md#play-2 — an unpowered robot must be carried.
  function verifyMoroTransport(samples) {
    const travelling = samples.filter((sample) => sample.phase === 'travelling');
    if (!travelling.length) throw new Error('Record active travel before checking transport.');
    for (const sample of travelling) {
      const actor = sample.actors.find((item) => item.id === 'moro');
      if (
        !actor?.visible ||
        actor.moving ||
        actor.waypoints !== 0 ||
        Math.hypot(actor.x - sample.avatar.x, actor.z - sample.avatar.z) > 1.14 ||
        sample.collision?.bodies.some((body) => !body.clear)
      )
        throw new Error(`Moro moved without its carrier: ${JSON.stringify(sample)}`);
    }
    return { frames: travelling.length };
  }
  async function investigate() {
    await field();
    for (let i = 0; i < 12; i++) {
      const hotspot = window.qaView.exploration.hotspots.find((item) => !item.visited);
      if (window.qaWorldAction && window.qaView.exploration.primaryAction?.kind !== 'inspect') break;
      if (!hotspot) break;
      if (window.qaView.exploration.primaryAction?.hotspotId === hotspot.id) {
        const active = window.qaView.exploration.hotspots.find(
          (item) => item.id === window.qaView.exploration.activeHotspot
        );
        if (active?.visited) await continueInspection();
        else await click('field-primary', true);
      } else {
        await field();
        const control = document.querySelector(`[data-action="inspect-${hotspot.id}"]`);
        const details = control?.closest('details');
        if (details && !details.open) details.querySelector('summary').click();
        await click(`inspect-${hotspot.id}`, true);
      }
      // Regression: ../artifacts/full-play-review.md#play-1 — dialogue must not pull us into the previous room.
      if (['moro', 'yunseo'].includes(hotspot.anchor)) {
        const { roomAt } = await import(new URL('museum-map.mjs', document.baseURI).href);
        const view = window.qaView;
        const { avatar, actors } = window.museumDiagnostics();
        const actor = actors.find((item) => item.id === hotspot.anchor);
        if (
          avatar.roomId !== view.currentRoomId ||
          !actor?.visible ||
          roomAt(actor.x, actor.z) !== view.currentRoomId ||
          Math.hypot(avatar.x - actor.x, avatar.z - actor.z) >= 1.98
        )
          throw new Error(
            `Inspection ${view.sceneId}/${
              hotspot.id
            } opened away from its speaker: ${JSON.stringify({ avatar, actor })}`
          );
      }
      await read();
    }
    await field();
    if (answers[window.qaView.sceneId] && window.qaView.exploration.deduction && !window.qaView.exploration.deductionSolved) {
      await click('field-primary');
      await click(`deduce-${answers[window.qaView.sceneId]}`);
      await click('deduce-submit', true);
      await click('close-panel');
    }
  }
  async function scene(choiceId) {
    await investigate();
    const before = window.qaView;
    if (boards[before.sceneId]) {
      await click(
        before.exploration.primaryAction?.kind === 'puzzle' ? 'field-primary' : 'open-puzzle'
      );
      for (const id of boards[before.sceneId][choiceId])
        await click(`${before.sceneId === 'P12' ? 'node' : 'piece'}-${id}`);
      await click('puzzle-review');
      await click('puzzle-submit', true);
    } else {
      if (window.qaView.phase !== 'choosing') await click(
        before.exploration.primaryAction?.kind === 'choices'
          ? 'field-primary'
          : 'field-choices',
        true
      );
      await click(`choice-${choiceId}`);
      await click('confirm', true);
    }
    await read();
    const result = window.qaView;
    rows.push({
      sceneId: before.sceneId,
      choiceId,
      actualChoice: result.history.at(-1).choiceId,
      observations: before.exploration.hotspots.filter((h) => h.visited).length,
      flags: result.flags,
    });
    await click('continue', true);
    if (window.qaView?.phase === 'travelling' && window.qaTravel) await window.qaTravel();
    return { sceneId: window.qaView.sceneId, decisions: window.qaView.history.length };
  }
  async function play(route) {
    for (const step of route.split(' ')) {
      const [id, choice] = step.split('.');
      if (window.qaView.sceneId !== id)
        throw new Error(`Expected ${id}, got ${window.qaView.sceneId}`);
      await scene(choice);
    }
    await read();
    return { sceneId: window.qaView.sceneId, phase: window.qaView.phase, rows };
  }
  window.investigationQA = {
    click,
    read,
    field,
    continueInspection,
    restart,
    verifyMoroTransport,
    investigate,
    scene,
    play,
    rows,
  };
  return 'UI driver installed; rendered controls and optional real floor/E navigation';
};
