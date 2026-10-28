# Audio review — 2026-10-29

Scope: local changes in `public/audio.mjs`, reviewed read-only with the audio-design skill. JavaScript-only file; no typecheck script, lint script, or installed ESLint. No build or production source changes made.

Result: no blocking correctness issue found in this scope.

## Verification

Isolated headless Chromium loaded the current source through a Playwright route override, independent of dist and other reviewers' browser sessions. Real AudioContext/GainNode/BufferSource/Oscillator nodes were used; wrappers recorded node creation and ended events.

- Before gesture: diagnostics `locked`, no scene source/cache. Button click: `running`, museum ambience and music start.
- Master slider 0: actual master gain reached exactly 0.
- Dialogue: music duck reached 0.25 and ambience 0.55, while music/ambience slider buses retained 0.1936/0.16.
- 100 simultaneous confirms: oneShots capped at 24, then returned to 0 after 400 ms.
- Nine immediate scene changes: cache remained at 2; after 1.4 seconds retiringScene was null and exactly 2 buffer sources had not ended.
- Hidden event: context suspended. Changing desired scene while hidden then returning started the latest scene; exactly 2 live loop sources remained.
- Twelve cycles of one-shot + scene change + hidden/visible events: final context running, oneShots 0, retiringScene null, cache 2, exactly 2 live buffer sources.
- Generated buffers' measured absolute sample maximum: 0.162900. This measures source buffers, not summed master true peak.

## Limits

Visibility was simulated by overriding document.hidden and dispatching visibilitychange. OS background suspension, Safari interrupted state, physical output/listening quality, integrated loudness, and device-specific gesture policy were not measured. Initial unlock was tested through an actual Playwright button click. Temporary harness: `/tmp/series-audio-review.mjs`.

## Additional integration review

Read-only review expanded to `series-game.mjs`, `series-world.mjs`, `series-action-plan.mjs`, and `series-transition.mjs` at lead request. All five reviewed JavaScript modules pass `node --check`. No project TypeScript/lint command exists.

### P2 — Failed initial import removes both new-journey choices

`series-game.mjs:194` invalidates the current dialogue and hides the initial welcome before reading the chosen file. On malformed JSON, line 203 replaces that panel with an error dialogue. Completing that error closes the panel; with no existing state, `refresh()` returns immediately and never redraws the two start buttons.

Reproduced in isolated Chromium using the actual current series-game source and stubbed world/audio/content dependencies (no renderer/build dependency): initial visible buttons included `모로와 함께 간다` and `담당자에게 맡기고 간다`. Uploading `{bad` as broken.json and dismissing `현장으로` left only download/import/close menu buttons, diagnostics view=null and transition=idle. New journey requires closing/reopening. Pending initial import canceled by visibility has the same welcome-restoration gap by source inspection.

Restore the initial welcome on failed/canceled import when state is absent; retain the existing state/dialogue flow when present. Temporary reproduction: `/tmp/series-import-review.mjs`.

Action lifecycle review: state revision and generation guard delayed completion; hidden state cancels animation and restores saved projection; import is excluded during action/transition; completed action projection is rebuilt from saved actions. No additional blocking source defect established. Physical reachability and all route branch animations remain covered by lead integration QA, not claimed by this source review.

## Narrative/world fidelity follow-up

Compared current action/world projections against `docs/series/consequence-rules.md` and episode endings.

### P2 — Confirmed attendee 정연 is absent from the final world

`series-world.mjs:237` creates neighbor, 문정, 소희, 태오, and 이든 in episode 5; episode-5 hotspot definitions create 나래. No episode-5 code creates 정연. `participants.jungyeon` is available but only used to reposition the episode-3 actor. Thus attendance-confirmed and declined final worlds have no 정연 actor, although `series-content.mjs` intro explicitly announces her arrival and episode-05 lines 27–29 require her ordinary attendance. Create her episode-5 actor and gate visibility with the saved attendance fact.

### P2 — Unverified mobile-light ending animates the same completed trial

`series-action-plan.mjs:34–35` always assembles the mobile-light prototype and carries it forward through a labelled 운반 시험. No episode-4 projection branches on mobileLight/fixedLight. Direct Node comparison of completed B action plans with mobileLight false vs true produced identical projections: lamp x=2,y=.31,z=-3,visible=true. Episode-04 lines 199/205 instead require the unverified branch to leave the specimen and record carrying height on paper, without adding a final free trial. Use a pending-test paper/prototype action/projection for the unverified branch. Preparation facts correctly remain false and episode-5 equipment visibility is gated; this finding concerns the contradictory physical execution.

Checked boundaries with no additional finding: unverified return sign remains at workshop-side coordinates; episode-5 lamp visibility requires selected equipment readiness; private recording never enters generated public music; new boat is a separate field object from the museum's original boat; 이든/태오 visibility follows handover. Source inspection only for this follow-up; no claim of exhaustive rendered branch coverage.

## Fix source recheck

The two world-fidelity findings above are addressed in current source: episode 5 now creates 정연 and gates visibility on attendance. Unverified fixed/mobile trial actions now write pending-test notes at the documentation desk; replay applies these conditional action effects. Direct projection comparison confirms unverified mobile lamp stays at z=-6 while verified branch moves to z=-3. No unchanged audio re-review was performed.

Gallery follow-up: selector supports episodes 1–5 with episode-specific prop/actor catalogs. Capture script selects the requested gallery, captures 3 pitches × 8 yaws per asset, adds zoom views, and checks expected view count. Both gallery modules pass syntax checks. Full image capture/visual review remains pending. Minor tooling caveat: capture CLI does not validate --episode while gallery URL clamps unsupported values to 1, so an invalid numeric option could label episode-1 captures with an invalid episode number; use only 1–5 until validation is added.

Final gallery source addition: Korean display labels matched all 37 manifest entries checked (no mismatches); actor family is derived from actors.ids and therefore remains 인물. This label edit occurred after the latest reported build and requires the next build. Actual 24-view gallery captures have not run in this review. No browser launched during active full1 QA.

## Latest source review — caption and initial import

P2 remaining: initial-import cancellation on hide still loses the welcome. `visibility()` cancels importing by incrementing generation and clearing importing. The stale file-read callback then returns and its finally token check skips restoration. The visible branch restores neither initialWelcome nor its hidden panel. Reproduce with no saved state, a delayed file.text(), hide/show before read resolves: state stays absent and both new-journey choices stay hidden. The malformed-file error dismissal now restores initialWelcome correctly; this cancellation path needs the equivalent no-state restoration.

No new defect found in native caption button/shared interaction guard or capture cleanup. resetPointer clears the stored pointer before releasing capture, so lostpointercapture cannot recurse into another release. Read-only source review; no concurrent GPU/browser work.

## Initial import fix verification and museum route follow-up

Initial import restoration is now verified in isolated Chromium without WebGL: malformed JSON dismissal restores both start choices; delayed File.text followed by hidden/visible events also restores both choices, and stale read completion leaves importing=false. Earlier initial-import findings are resolved.

Museum route source review: failed replanning now drops the blocked route and pendingInspect instead of retrying the same impossible path. Primary routeTo planning now passes active dynamic bodies. Remaining P2 caveat in routeTo's towingMoro radial fallback: its findPath call still omits both explicit navigationBody and the dynamic occupants array passed to the primary call. An NPC-occupied nearby fallback endpoint can therefore still be accepted initially; replanning later stops it. Pass the same body/occupants policy through fallback calls to fully apply the fix. No production source edits.

## Scripted-walk collision audit

P2 — Fixed follower offsets force geometry intersections on full episode-5 walks. Narae is already moved to (7,4) by setEpisode, so the suspected player-through-consult crossing is absent in current source. Two other collisions are guaranteed numerically:

- Fork field object is at (3,0), with its left physical post local x=-2.1 and a .14×.14 collider: world center(.9,0), maxX=.97. Neighbor follows player x+1.2, so when player passes (0,0), neighbor is at(1.2,0). Circle-to-box gap=.23 is below actor radius .35: .12 penetration.
- Role-board field object at(3,6), y=.95 gets a physical desk x[2.25,3.75], z[5.55,6.45]. Munjeong follows player x+2.05, so full return endpoint is(2.05,6). Gap=.20 is below actor radius .35: .15 penetration.

animateAction directly assigns positions without static/dynamic collision checks; full outward/return/second walks and final return-station therefore visibly intersect the post/desk even though ordinary movement uses collision. Revise participant offsets/routes or stage clearance, and validate swept participant paths rather than player center alone. Source/numeric verification only; no browser launched.

## WALK_FORMATION fix numeric recheck

Actual Three.js asset fixtures and collectStaticColliders were used for episode-5 field/primary props plus generated desks. Across 69 authored walk/greeting player/follower sweeps against 15 actual/table collider boxes, no static penetration remained; minimum circle-center-to-box gap was .585235. This includes shelter posts, role desk, fork posts, primary chair/reading desks. Temporary numeric harness `/tmp/series-clearance.mjs`; no GPU/browser used.

P2 — New actor-route prefix doubles back on short-return and crosses the player. Canonical start: player(2,-1), neighbor(.8,-1), munjeong(-.05,-1). Player route length=5. Neighbor route prepends lane x=-1.2 before adding the first shifted waypoint .8 again, producing [.8,-1]→[-1.2,-1]→[.8,-1]→[-1.2,-1]→[-1.2,-4], length=9. At normalized time .35 player is(.25,-1), neighbor(-.05,-1): distance .30 below combined collision radii .38+.35=.73. Avoid the redundant lane prefix when the actor already occupies the shifted start waypoint, then validate participant-to-player sweeps as well as static clearance. This finding supersedes the previous static formation defects; those are cleared by the negative offsets.

## Runtime-supported P1 — NPC refresh reset traps player

Independent source confirmation of lead run 46649: after episode-4 handoff-equipment, applyStory resets every actor to home without collision testing (`series-world.mjs:285`), whereas idle simulation previously allowed the NPC to patrol away from home. The player can legally occupy the vacated home vicinity before refresh, then the NPC teleports into the player.

Reported artifact position player(5.402478706835,2.46870669685), reset 이든(5,3) gives distance .6665295818 below required .73. Movement cannot recover: even an entire fixed .06 step directly away reaches only .7265295818; move further subdivides to ≤.045 and rejects every proposal while overlap remains. This is a real locomotion deadlock, not merely direct steering against a standing NPC. Preserve ambient NPC positions across ordinary refresh and make authored/replay positioning collision-safe; synchronize interaction hotspots when relocating actors. No browser run or production edit in this review.
