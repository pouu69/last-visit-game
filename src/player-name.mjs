const PLAYER_NAMES = Object.freeze([
  '가람', '나루', '다온', '도담', '라온', '마루', '바다', '보리',
  '새봄', '소담', '수풀', '아람', '여울', '온유', '이든', '자람',
  '초롱', '하람', '한결', '해솔', '노을', '단비', '모아', '별하',
  '솔빛', '윤슬', '은솔', '초아', '푸름', '하늘', '해나', '산들',
]);

// Session IDs already contain random bytes. Reusing them keeps legacy names stable too.
export function playerNameForSession(sessionId) {
  return PLAYER_NAMES[Number.parseInt(sessionId.slice(-8), 16) % PLAYER_NAMES.length];
}
