# Isolated series runtime QA

- Tested preview http://localhost:5188 using Playwright full Chromium (`channel: chromium`, headless), 640×480.
- Mounted `/series-game.mjs` in an isolated HTML fixture with series CSS. Input: museum E1 terminal, boat intact, record intact, Moro active; session `qa-isolated`; storage null.
- This is a harness fixture, not proof of full episode 1 gameplay or museum-to-series handoff.
- Used pointer clicks for Moro accompaniment, all dialogue, and choices; actual keyboard WASD for movement and E for interactions.
- Completed episode 2 path A / A / A / A: inspected A; consulted; chose deduction and time and execution; performed `store-sign` and `guide-demonstration`; walked to exit and pressed E; transition reached episode 3 inspection, revision 8, player reset to (0,6).
- Captured page errors and console errors: empty.
- Screenshot: `ep2-next.png`. Structured state/event evidence: `runtime.json`. Repro script: `runtime.cjs`.

## Scope and limitations

- Only one episode 2 path was exercised. Episodes 3–5 gameplay, save/restore, desktop/mobile layouts, full episode 1 entry and production deployment remain unverified by this run.
- Original headless shell was too slow when the museum canvas was also active. Full Chromium with one isolated series canvas was responsive. This does not establish production frame rate.
- Initial navigation no-movement was a harness error: intro dialogue exceeded a 20-line cap and world remained locked. A second harness correction excluded hidden retained dialogue buttons. These are not product blockers.
- At 640×480 the save-warning HUD wraps over multiple lines. No assertion of general visual QA completion.
