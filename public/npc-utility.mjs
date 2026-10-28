// Small seeded utility layer for ambient NPC movement. Authored rooms and routes stay fixed.
export function seededWanderPoints(seed, origin, radius = 2.4, count = 8) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2;
    const distance = radius * (0.35 + random() * 0.65);
    return [origin.x + Math.cos(angle) * distance, origin.z + Math.sin(angle) * distance];
  });
}

// Keep a visible, approachable distance while avoiding tiny back-and-forth route changes.
export function scoreWanderPoint(point, actor, player) {
  const fromPlayer = Math.hypot(point[0] - player.x, point[1] - player.z);
  const fromActor = Math.hypot(point[0] - actor.x, point[1] - actor.z);
  const approachable = Math.max(0, 1 - Math.abs(fromPlayer - 1.25) / 2.5);
  const purposefulMotion = Math.min(1, fromActor / 2.4);
  return approachable * 0.72 + purposefulMotion * 0.28;
}
