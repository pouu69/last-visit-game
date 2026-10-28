"""Validate the draft route specification; this is not the game's runtime."""
from collections import deque
from itertools import permutations
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'docs/narrative/scene-routes.md'
source = SPEC.read_text()
nodes = {}
node = None
for line in source.splitlines():
    heading = re.match(r'^### ([A-Z]\d{2}) — (.*)', line)
    if heading:
        node = heading.group(1)
        nodes[node] = {'title': heading.group(2), 'choices': {}}
    elif node and re.match(r'^\| [ABCD] \|', line):
        columns = [column.strip() for column in line.strip('|').split('|')]
        choice = columns[0]
        assert choice not in nodes[node]['choices'], (node, choice, 'duplicate')
        targets = re.findall(r'\b(?:[A-Z]\d{2}|E[1-6])\b', columns[-1])
        nodes[node]['choices'][choice] = {'targets': targets, 'condition': columns[-1], 'action': columns[1]}

ENDINGS = {f'E{i}' for i in range(1, 7)}
for name, data in nodes.items():
    assert set(data['choices']) == set('ABCD'), (name, data['choices'])
    for choice, row in data['choices'].items():
        assert row['targets'], (name, choice, 'missing target')
        assert set(row['targets']) <= set(nodes) | ENDINGS, (name, choice, row)
assert len(nodes) == 21, len(nodes)

# Each chapter has different local routes, but every complete run has 11 decisions.
def depths(name, stack=()):
    if name in ENDINGS:
        return {0}
    assert name not in stack, ('cycle', stack, name)
    return {1 + depth for row in nodes[name]['choices'].values()
            for target in row['targets'] for depth in depths(target, (*stack, name))}
assert depths('S01') == {11}, depths('S01')

FLAGS = ('charter', 'log', 'statement', 'request', 'battery', 'map', 'maintenance', 'repair')
INITIAL = (frozenset(), 'locked', 'locked', 'active')

def move(node, choice, state):
    held, boat, record, moro = state
    flags = set(held)
    def add(name):
        flags.add(name)
    def maintenance():
        add('maintenance' if 'map' in flags else 'map')
    def has_evidence():
        return 'statement' in flags or (('charter' in flags or record == 'intact') and bool({'log', 'request'} & flags))
    i = 'ABCD'.index(choice)
    if node == 'S01':
        target = ['I01', 'I02', 'I03', 'I04'][i]
    elif node in ('I01', 'I02', 'I03', 'I04'):
        gains = {'I01': ['log', 'battery', 'map', 'request'],
                 'I02': ['charter', 'request', 'battery', 'map'],
                 'I03': ['map', 'battery', 'request', 'log'],
                 'I04': ['charter', 'request', 'battery', 'map']}
        gain = gains[node][i]
        add(gain)
        target = 'P12' if gain in ('battery', 'map') else 'P11'
    elif node in ('P11', 'P12'):
        if choice == {'P11': 'A', 'P12': 'B'}[node]:
            add('map')
        target = 'S12'
    elif node == 'S12':
        target = 'T21' if i < 2 else 'T22'
    elif node in ('T21', 'T22'):
        add(['log' if node == 'T21' else 'statement', 'request', 'battery', 'map'][i])
        target = 'D21' if i < 2 else 'D22'
    elif node == 'D21':
        add(['charter', 'log', 'request', 'repair'][i])
        target = 'S22'
    elif node == 'D22':
        if choice == 'A':
            maintenance()
        else:
            add({'B': 'battery', 'C': 'charter', 'D': 'repair'}[choice])
        target = 'S22'
    elif node == 'S22':
        if choice == 'C':
            maintenance()
        else:
            add({'A': 'request', 'B': 'statement', 'D': 'battery'}[choice])
        target = 'P21'
    elif node == 'P21':
        target = 'R31' if choice == 'B' else 'R32'
    elif node == 'R31':
        if choice == 'A':
            boat, record = 'intact', 'unreadable'
        elif choice == 'B':
            boat, record = 'damaged', 'intact'
        elif choice == 'C':
            boat, record, moro = 'intact', 'intact', 'asleep'
        elif {'maintenance', 'battery'} <= flags:
            boat, record = 'intact', 'intact'
            flags.remove('battery')
        else:
            boat, record = 'sealed', 'sealed'
        target = 'S31'
    elif node == 'R32':
        if choice == 'A':
            boat, record = 'damaged', 'unreadable'
        elif choice == 'B':
            boat, record, moro = 'damaged', 'intact', 'asleep'
        elif choice == 'C':
            boat, moro = 'intact', 'asleep'
            if 'battery' in flags:
                record = 'intact'
                flags.remove('battery')
            else:
                record = 'unreadable'
        elif 'maintenance' in flags:
            boat, record = 'intact', 'unreadable'
        else:
            boat, record = 'sealed', 'sealed'
        target = 'S31'
    elif node == 'S31':
        target = ['F31', 'F32', 'F33', 'F34'][i]
    elif node == 'F31':
        if choice == 'B' and boat == 'damaged' and 'repair' in flags:
            boat = 'intact'
            flags.remove('repair')
        target = ('E1' if boat == 'intact' else 'E2') if i < 2 else ('E2' if choice == 'C' else 'E5')
    elif node == 'F32':
        if choice == 'B':
            if moro == 'asleep' and 'battery' in flags:
                flags.remove('battery')
                moro = 'active'
            if moro == 'active':
                add('log')
        target = ('E3' if has_evidence() else 'E4') if i < 2 else ('E4' if choice == 'C' else 'E5')
    elif node == 'F33':
        if choice == 'B' and moro == 'asleep' and 'battery' in flags:
            flags.remove('battery')
            moro = 'active'
        target = ('E1' if boat == 'intact' else 'E2') if choice == 'D' else 'E5'
    elif node == 'F34':
        target = 'E5' if choice == 'D' else 'E6'
    else:
        raise AssertionError(('undefined node', node))
    assert target in nodes[node]['choices'][choice]['targets'], ('model/spec target mismatch', node, choice, target)
    return target, (frozenset(flags), boat, record, moro)

queue = deque([('S01', INITIAL, [])])
seen = set()
reached = set()
ending_examples = {}
transitions = 0
rescue_variants = set()
mission_failure_endings = set()
while queue:
    node, state, path = queue.popleft()
    # Separate the failed mission history to prove recovery, not merely all endings.
    failed_mission = any(n == 'P21' and c != 'B' for n, c in path)
    key = (node, state, failed_mission)
    if key in seen:
        continue
    seen.add(key)
    if node in ENDINGS:
        assert len(path) == 11, (node, path)
        ending_examples.setdefault(node, path)
        if failed_mission:
            mission_failure_endings.add(node)
        if node == 'E1':
            assert state[1] == 'intact'
        if node == 'E3':
            flags, _, record, _ = state
            assert 'statement' in flags or (('charter' in flags or record == 'intact') and bool({'log', 'request'} & flags))
        continue
    reached.add(node)
    for choice in 'ABCD':
        target, new_state = move(node, choice, state)
        assert new_state[0] <= set(FLAGS)
        if state[2] == 'unreadable':
            assert new_state[2] == 'unreadable', ('record resurrected', node, choice)
        if state[1] == 'sealed':
            assert new_state[1] == 'sealed', ('sealed boat teleported', node, choice)
        if state[3] == 'asleep' and new_state[3] == 'active':
            assert node in ('F32', 'F33') and choice == 'B' and 'battery' in state[0]
            assert 'battery' not in new_state[0], ('Moro woke without spending charge', node, choice)
        if node in ('R31', 'R32'):
            assert new_state[1] != 'locked' and new_state[2] != 'locked'
            rescue_variants.add((node, choice, new_state[1:]))
        transitions += 1
        queue.append((target, new_state, [*path, (node, choice)]))
assert reached == set(nodes), ('unreachable', set(nodes) - reached)
assert set(ending_examples) == ENDINGS
assert mission_failure_endings == ENDINGS, mission_failure_endings

stamps = ['bell', 'leaf', 'wave', 'star']
stamp_answers = [p for p in permutations(stamps)
                 if abs(p.index('bell') - p.index('wave')) == 2
                 and p.index('leaf') == p.index('bell') + 1
                 and p.index('star') > p.index('wave')
                 and p.index('star') > p.index('leaf')]
assert stamp_answers == [('bell', 'leaf', 'wave', 'star')], stamp_answers
paths = {'A': (4, False), 'B': (5, True), 'C': (7, True), 'D': (4, False)}
best_distance = min(distance for distance, safe in paths.values() if safe)
assert [k for k, (distance, safe) in paths.items() if safe and distance == best_distance] == ['B']
crane_answers = [p for p in permutations(['close', 'fix', 'lift', 'off'])
                 if p.index('close') < p.index('fix') < p.index('lift') < p.index('off')]
assert crane_answers == [('close', 'fix', 'lift', 'off')], crane_answers

# Confirm every listed terminal branch is actually taken, including conditional exits.
observed_edges = set()
for node, state, _ in seen:
    if node in ENDINGS:
        continue
    for choice in 'ABCD':
        target, _ = move(node, choice, state)
        observed_edges.add((node, choice, target))
listed_edges = {(node, choice, target) for node, data in nodes.items()
                for choice, row in data['choices'].items() for target in row['targets']}
assert observed_edges == listed_edges, ('unreachable edge', listed_edges - observed_edges)

# The paper original alone cannot prove the institution changed its rules.
unproven = (frozenset(), 'intact', 'intact', 'asleep')
assert move('F32', 'A', unproven)[0] == 'E4'
assert move('F32', 'B', unproven)[0] == 'E4'
awake = (frozenset(), 'damaged', 'intact', 'active')
assert move('F32', 'B', awake)[0] == 'E3'
charged = (frozenset({'battery'}), 'intact', 'intact', 'asleep')
assert move('F32', 'B', charged)[0] == 'E3'
assert 'battery' not in move('F32', 'B', charged)[1][0]
request_pair = (frozenset({'charter', 'request'}), 'intact', 'unreadable', 'asleep')
assert move('F32', 'A', request_pair)[0] == 'E3'

sample_paths = {
    '배를 돌려보낸 팀': 'S01.A I01.B P12.B S12.A T21.D D22.A S22.B P21.B R31.D S31.A F31.A',
    '규약 변경을 밝혀낸 팀': 'S01.B I02.A P11.C S12.D T22.C D22.D S22.B P21.C R32.B S31.B F32.B',
    '모로를 데리고 나온 팀': 'S01.C I03.B P12.C S12.B T21.D D22.D S22.C P21.A R32.C S31.C F33.A',
}
samples = {}
for name, trace in sample_paths.items():
    current, state = 'S01', INITIAL
    for step in trace.split():
        node, choice = step.split('.')
        assert node == current, (name, node, current)
        current, state = move(node, choice, state)
    assert current in ENDINGS
    samples[name] = {'route': trace + ' → ' + current, 'flags': sorted(state[0]),
                     'boat': state[1], 'record': state[2], 'moro': state[3]}

report = {'decision_nodes': len(nodes), 'choices': sum(len(n['choices']) for n in nodes.values()),
          'listed_edges_with_conditions': len(listed_edges), 'decisions_per_play': 11,
          'visited_state_keys': len(seen), 'checked_transitions': transitions,
          'reachable_endings': sorted(ending_examples), 'endings_after_mission2_failure': sorted(mission_failure_endings),
          'unique_mission_answers': {'P11': 'A', 'P12': 'B', 'P21': 'B'},
          'tabletop_examples': samples,
          'ending_examples': {k: ' → '.join(f'{n}.{c}' for n, c in v) + f' → {k}' for k, v in sorted(ending_examples.items())}}
print(json.dumps(report, ensure_ascii=False, indent=2))

lines = ['flowchart TD']
chapters = [('1장 · 사라진 제1호', ['S01', 'I01', 'I02', 'I03', 'I04', 'P11', 'P12', 'S12']),
            ('2장 · 지워진 반환일', ['T21', 'T22', 'D21', 'D22', 'S22', 'P21']),
            ('3장 · 아직 오지 않은 날', ['R31', 'R32', 'S31', 'F31', 'F32', 'F33', 'F34'])]
for i, (name, ids) in enumerate(chapters):
    lines.append(f'  subgraph CH{i+1}["{name}"]')
    for node in ids:
        title = nodes[node]['title'].split(' / ')[0].replace('"', '')
        lines.append(f'    {node}["{node} {title}"]')
    lines.append('  end')
ending_names = ['강으로 돌아간 약속', '다음 사람에게 보내는 편지', '비어 있는 진열장의 빛', '이름 없는 창문', '마지막 안내원의 퇴근', '문을 연 박물관']
for i, name in enumerate(ending_names, 1):
    lines.append(f'  E{i}(["E{i} {name}"])')
for node, data in nodes.items():
    for target in sorted({t for row in data['choices'].values() for t in row['targets']}):
        choices = '/'.join(c for c, row in data['choices'].items() if target in row['targets'])
        conditional = any(len(row['targets']) > 1 and target in row['targets'] for row in data['choices'].values())
        label = choices + (' 조건별' if conditional else '')
        lines.append(f'  {node} -->|"{label}"| {target}')
lines.extend(['  classDef mission fill:#dce9e3,stroke:#295d50,color:#173d35;',
              '  classDef ending fill:#f6e8c7,stroke:#9a7838,color:#46391f;',
              '  class P11,P12,P21 mission;', '  class E1,E2,E3,E4,E5,E6 ending;'])
(ROOT / 'docs/narrative/route-map.mmd').write_text('\n'.join(lines) + '\n')
(ROOT / 'docs/narrative/route-map.md').write_text('# 전체 루트맵\n\n장면 ID와 A~D를 읽는 용도다. 조건과 선택별 효과는 `scene-routes.md`가 기준이다. 같은 선에 묶인 선택도 획득 정보·대화·후일담이 다를 수 있다.\n\n```mermaid\n' + '\n'.join(lines) + '\n```\n')
(ROOT / 'artifacts/narrative-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
