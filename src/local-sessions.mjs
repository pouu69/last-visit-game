import {
  createGame,
  dispatch,
  publicView,
  saveGame,
  restoreGame,
  LIMITS,
} from './playbook.mjs';

const RECORD_PREFIX = 'museum-local-record-v1:';
const STORAGE_WARNING =
  '이 브라우저에 자동 저장할 수 없습니다. 기록 내려받기로 진행을 보관해 주세요.';
const isSessionId = (value) => typeof value === 'string' && /^[a-f0-9]{48}$/.test(value);

function sessionError(code, message) {
  return Object.assign(new Error(message), { code });
}

function checked(result) {
  if (!result.ok) throw sessionError(result.error.code, result.error.message);
  if (result.effects?.length)
    throw sessionError(
      'UNEXPECTED_EFFECT',
      '외부 요청이 필요한 사건입니다. 현재 게임을 새로고침해 주세요.'
    );
  return result;
}

function randomId() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Synchronous browser sessions use canonical engine save records, never state snapshots.
 * storage may be null or unavailable: gameplay then stays in this instance's memory,
 * and every response carries an export reminder. createId is injectable for replayable tests.
 * After a storage failure this session stays memory-only; import its export as a new session.
 * Invalid events/imports throw tagged errors before replacing an existing session.
 */
export function createLocalSessions({ storage = null, createId = randomId } = {}) {
  const sessions = new Map();

  function load(id) {
    if (!isSessionId(id))
      throw sessionError(
        'INVALID_SESSION',
        '게임 기록 ID 형식이 잘못되었습니다. 새 게임을 시작하거나 기록 파일을 가져와 주세요.'
      );
    const cached = sessions.get(id);
    if (cached?.memoryOnly || !storage) {
      if (cached) return cached;
      throw sessionError(
        'SESSION_NOT_FOUND',
        '이 브라우저에 게임 기록이 없습니다. 새 게임을 시작하거나 기록 파일을 가져와 주세요.'
      );
    }
    let serialized;
    try {
      serialized = storage.getItem(RECORD_PREFIX + id);
    } catch {
      if (cached) {
        cached.memoryOnly = true;
        return cached;
      }
      throw sessionError(
        'STORAGE_UNAVAILABLE',
        '브라우저 저장소를 읽을 수 없습니다. 저장소 접근을 허용하거나 기록 파일로 게임을 가져와 주세요.'
      );
    }
    if (serialized === null)
      throw sessionError(
        'SESSION_NOT_FOUND',
        '이 브라우저에 게임 기록이 없습니다. 새 게임을 시작하거나 기록 파일을 가져와 주세요.'
      );
    if (serialized.length > LIMITS.saveBytes + 1024)
      throw sessionError(
        'SAVE_LIMIT',
        '브라우저 저장 기록이 2MB 한도를 넘었습니다. 원래 내려받은 기록 파일을 가져와 주세요.'
      );
    if (cached?.serialized === serialized) return cached;
    let record;
    try {
      record = JSON.parse(serialized);
    } catch {
      throw sessionError(
        'INVALID_SAVE',
        '브라우저 저장 기록의 JSON이 손상되었습니다. 원래 내려받은 기록 파일을 가져와 주세요.'
      );
    }
    const { state } = checked(restoreGame(record));
    const entry = { state, serialized, memoryOnly: false };
    sessions.set(id, entry);
    return entry;
  }

  function persist(id, state) {
    const { record } = checked(saveGame(state));
    const serialized = JSON.stringify(record);
    const entry = { state, serialized, memoryOnly: true };
    // Do not retry a failed tab over a record another tab may have advanced.
    if (storage && !sessions.get(id)?.memoryOnly) {
      try {
        storage.setItem(RECORD_PREFIX + id, serialized);
        entry.memoryOnly = false;
      } catch {
        // Keep the newest state after quota/policy failures; stale disk data cannot replace it.
      }
    }
    sessions.set(id, entry);
    return entry;
  }

  function unusedId() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const id = createId();
      if (!isSessionId(id))
        throw sessionError(
          'INVALID_SESSION_ID',
          '새 게임 ID는 48자리 소문자 16진수여야 합니다. ID 생성 함수를 확인해 주세요.'
        );
      if (sessions.has(id)) continue;
      if (!storage) return id;
      try {
        if (storage.getItem(RECORD_PREFIX + id) !== null) continue;
      } catch {
        return id;
      }
      return id;
    }
    throw sessionError(
      'SESSION_ID_COLLISION',
      '새 게임 ID가 기존 기록과 겹칩니다. 다시 시작해 주세요.'
    );
  }

  function response(entry) {
    return {
      view: publicView(entry.state),
      ...(entry.memoryOnly ? { warning: STORAGE_WARNING } : {}),
    };
  }

  return Object.freeze({
    create(teamId) {
      const { state } = checked(createGame(teamId));
      const sessionId = unusedId();
      return { sessionId, ...response(persist(sessionId, state)) };
    },
    get(id) {
      return response(load(id));
    },
    event(id, event) {
      const current = load(id);
      const { state } = checked(dispatch(current.state, event));
      return response(persist(id, state));
    },
    save(id) {
      const entry = load(id);
      return {
        record: checked(saveGame(entry.state)).record,
        ...(entry.memoryOnly ? { warning: STORAGE_WARNING } : {}),
      };
    },
    restore(id, record) {
      const { state } = checked(restoreGame(record));
      if (id !== null && load(id).state.teamId !== state.teamId)
        throw sessionError(
          'TEAM_MISMATCH',
          '가져올 기록의 팀이 현재 게임과 다릅니다. 해당 팀에서 기록을 가져와 주세요.'
        );
      const sessionId = id ?? unusedId();
      const restored = response(persist(sessionId, state));
      return id === null ? { sessionId, ...restored } : restored;
    },
  });
}
