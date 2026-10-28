async () => {
  if (window.__qa) return { installed: true };
  const original = window.fetch;
  const q = (window.__qa = { view: null, pending: null, results: [] });
  q.waitFor = (condition) =>
    new Promise((resolve, reject) => {
      let frame;
      const timeout = setTimeout(() => {
        cancelAnimationFrame(frame);
        reject(new Error('Browser UI did not settle within 3 seconds'));
      }, 3000);
      function check() {
        if (condition()) {
          clearTimeout(timeout);
          resolve();
          return;
        }
        frame = requestAnimationFrame(check);
      }
      check();
    });
  window.fetch = (...args) => {
    const p = original(...args);
    q.pending = p.then(async (r) => {
      const j = await r.clone().json();
      if (j.view) q.view = j.view;
      return j;
    });
    return p;
  };
  q.settle = async () => {
    if (q.pending) {
      const j = await q.pending;
      if (j.error) throw new Error(j.error.message);
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await q.waitFor(() => document.querySelector('#game').getAttribute('aria-busy') !== 'true');
  };
  q.click = async (selector) => {
    const b = document.querySelector(selector);
    if (!b) throw new Error('Missing ' + selector);
    if (b.disabled) throw new Error('Disabled ' + selector);
    q.pending = null;
    b.click();
    await q.settle();
  };
  q.restore = async (record) => {
    const input = document.querySelector('#restore-file');
    const d = new DataTransfer();
    d.items.add(new File([JSON.stringify(record)], 'rehearsal.json', { type: 'application/json' }));
    input.files = d.files;
    q.pending = null;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await q.waitFor(() => q.pending !== null);
    await q.settle();
  };
  // UI-1 regression: a modal must own navigation keys while the story stays still.
  q.checkModalKeyboard = async () => {
    if (!q.view?.canNext) throw new Error('Open a partially read scene for UI-1');
    await q.click('#history-toggle');
    const log = document.querySelector('#messages');
    log.focus();
    const revision = q.view.revision;
    q.pending = null;
    log.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await q.settle();
    if (q.view.revision !== revision) throw new Error('UI-1: modal key advanced the story');
    await q.click('[data-close="history-panel"]');
    return { before: revision, after: q.view.revision };
  };
  q.run = async (cases) => {
    for (const c of cases) {
      await q.restore(c.record);
      if (q.view.sceneId !== c.sceneId) throw new Error(c.id + ' restore mismatch');
      if (q.view.phase !== 'choosing') await q.click('[data-action="choices"]');
      await q.click('[data-choice="' + c.choiceId + '"]');
      await q.click('[data-action="confirm"]');
      let count = 0;
      while (q.view.canNext) {
        await q.click('[data-action="next"]');
        count++;
      }
      const f = q.view.flags;
      const flags = [
        'charter',
        'log',
        'statement',
        'request',
        'battery',
        'map',
        'maintenance',
        'repair',
      ]
        .filter((id) => f[id])
        .sort();
      if (JSON.stringify([flags, f.boat, f.record, f.moro]) !== JSON.stringify(c.expected))
        throw new Error(c.id + ' flags mismatch');
      await q.click('[data-action="continue"]');
      if (q.view.sceneId !== c.nextSceneId) throw new Error(c.id + ' destination mismatch');
      if (/^E/.test(q.view.sceneId)) {
        while (q.view.canNext) {
          await q.click('[data-action="next"]');
          count++;
        }
        if (q.view.phase !== 'terminal') throw new Error('unread ending');
      }
      q.results.push({ id: c.id, next: q.view.sceneId, resultMessages: count + 1 });
    }
    return { completed: q.results.length, last: q.results.at(-1) };
  };
  return { installed: true };
};
