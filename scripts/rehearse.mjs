import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGame, dispatch, publicView, saveGame } from '../src/playbook.mjs';
import { applyRoute, INITIAL_FLAGS } from '../src/route-rules.mjs';

// The independently written Python design model supplies expected outcomes and reachable prefixes.
const oracle = JSON.parse(
  execFileSync(
    'python3',
    [
      '-c',
      `
import contextlib, io, runpy, json
from collections import deque
with contextlib.redirect_stdout(io.StringIO()):
    m=runpy.run_path('scripts/check-narrative.py')
queue=deque([('S01',m['INITIAL'],[])])
seen=set(); rows=[]
def pack(s): return [sorted(s[0]),s[1],s[2],s[3]]
while queue:
    node,state,path=queue.popleft()
    key=(node,state)
    if key in seen: continue
    seen.add(key)
    if node in m['ENDINGS']: continue
    for choice in 'ABCD':
        target,after=m['move'](node,choice,state)
        rows.append([node,choice,pack(state),target,pack(after),path])
        queue.append((target,after,path+[[node,choice]]))
print(json.dumps(rows,separators=(',',':')))
`,
    ],
    { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 }
  )
);

const flagsFrom = ([held, boat, record, moro]) => ({
  ...INITIAL_FLAGS,
  ...Object.fromEntries(held.map((key) => [key, true])),
  boat,
  record,
  moro,
});
const packed = (flags) => [
  Object.keys(INITIAL_FLAGS)
    .filter((key) => flags[key] === true)
    .sort(),
  flags.boat,
  flags.record,
  flags.moro,
];
const edges = new Set();
const choices = new Set();
const cases = new Map();
const gains = {
  I01: ['log', 'battery', 'map', 'request'],
  I02: ['charter', 'request', 'battery', 'map'],
  I03: ['map', 'battery', 'request', 'log'],
  I04: ['charter', 'request', 'battery', 'map'],
  T21: ['log', 'request', 'battery', 'map'],
  T22: ['statement', 'request', 'battery', 'map'],
  D21: ['charter', 'log', 'request', 'repair'],
  D22: [null, 'battery', 'charter', 'repair'],
  S22: ['request', 'statement', null, 'battery'],
};
function variant(scene, choice, flags) {
  const keys = [];
  const gain = gains[scene]?.['ABCD'.indexOf(choice)];
  if (gain) keys.push(`${gain}=${flags[gain]}`);
  if ((scene === 'D22' && choice === 'A') || (scene === 'S22' && choice === 'C'))
    keys.push(`map=${flags.map}`, `maintenance=${flags.maintenance}`);
  if (scene === 'P11' || scene === 'P12') keys.push(`map=${flags.map}`);
  if (scene === 'R31' && choice === 'D')
    keys.push(`maintenance=${flags.maintenance}`, `battery=${flags.battery}`);
  if (scene === 'R32' && choice === 'C') keys.push(`battery=${flags.battery}`);
  if (scene === 'R32' && choice === 'D') keys.push(`maintenance=${flags.maintenance}`);
  if (scene === 'F31' || (scene === 'F33' && choice === 'D'))
    keys.push(
      `boat=${flags.boat}`,
      ...(scene === 'F31' && choice === 'B' ? [`repair=${flags.repair}`] : [])
    );
  if (scene === 'F32') keys.push(`moro=${flags.moro}`, `battery=${flags.battery}`);
  if (scene === 'F33' && choice === 'B')
    keys.push(`moro=${flags.moro}`, `battery=${flags.battery}`);
  return keys.join(',') || 'default';
}

for (const [scene, choice, beforePacked, target, afterPacked, path] of oracle) {
  const before = flagsFrom(beforePacked);
  const actual = applyRoute(scene, choice, before);
  const label = `${scene}.${choice}`;
  assert.equal(
    actual.nextSceneId,
    target,
    `${label}: destination disagrees with Python specification`
  );
  assert.deepEqual(
    packed(actual.flags),
    afterPacked,
    `${label}: resource outcome disagrees with Python specification`
  );
  edges.add(`${label}>${target}`);
  choices.add(label);
  const id = `${label}:${variant(scene, choice, before)}>${target}`;
  if (!cases.has(id)) cases.set(id, { id, scene, choice, target, path, expected: afterPacked });
}
assert.equal(choices.size, 84);
assert.equal(edges.size, 89);

function send(state, type, fields = {}) {
  const result = dispatch(state, {
    type,
    teamId: state.teamId,
    sceneId: state.sceneId,
    revision: state.revision,
    ...fields,
  });
  assert.equal(result.ok, true, `${state.sceneId} ${type}: ${JSON.stringify(result.error)}`);
  return result.state;
}
function read(state) {
  while (publicView(state).canNext) state = send(state, 'NEXT');
  return state;
}
function checkpoint(path) {
  let state = createGame(1, { mode: 'legacy' }).state;
  for (const [scene, choice] of path) {
    assert.equal(state.sceneId, scene);
    state = send(state, 'OPEN_CHOICES');
    state = read(send(state, 'CHOOSE', { choiceId: choice }));
    state = send(state, 'CONTINUE');
  }
  return read(state);
}

const browserCases = [];
const endings = new Set();
let messageCount = 0;
for (const example of cases.values()) {
  let state = checkpoint(example.path);
  assert.equal(state.sceneId, example.scene);
  const record = saveGame(state).record;
  if (state.phase !== 'choosing') state = send(state, 'OPEN_CHOICES');
  state = read(send(state, 'CHOOSE', { choiceId: example.choice }));
  assert.deepEqual(packed(state.flags), example.expected, example.id);
  assert.ok(
    state.messages.every((message) => !/\*\*(?:상태|다음|삽입|조건):/.test(message.text)),
    example.id
  );
  messageCount += state.messages.length;
  state = send(state, 'CONTINUE');
  assert.equal(state.sceneId, example.target);
  if (state.ending) {
    state = read(state);
    endings.add(state.sceneId);
    assert.equal(state.phase, 'terminal');
  }
  browserCases.push({
    id: example.id,
    sceneId: example.scene,
    choiceId: example.choice,
    nextSceneId: example.target,
    expected: example.expected,
    record,
  });
}
assert.equal(endings.size, 6);
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/rehearsal-checkpoints.json', JSON.stringify(browserCases));
const report = {
  kind: 'deterministic-engine-rehearsal',
  oracleTransitions: oracle.length,
  choices: choices.size,
  conditionalEdges: edges.size,
  behavioralCases: cases.size,
  endings: [...endings].sort(),
  authoredMessagesInspected: messageCount,
  checkpointSha256: createHash('sha256').update(JSON.stringify(browserCases)).digest('hex'),
  scope:
    'Unique A–D choices, destination branches and explicit resource guards. Browser execution is recorded separately; this is not every possible text question or every 4^11 sequence.',
};
await writeFile('artifacts/rehearsal-engine.json', `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
