import { walkableAt } from './museum-map.mjs';

const MAX_MOVE_STEP = 0.06;
const CONTACT_EPSILON = Number.EPSILON * 64;

/**
 * Tests a circular body against the floor, world-space AABBs, and other circular bodies.
 * Tangency is allowed; occupants with the body's id are ignored. Inputs are never mutated.
 * Boxes and occupants must contain finite world coordinates and nonnegative sizes/radii.
 */
export function canOccupy(body, x, z, boxes, occupants = []) {
  if (!walkableAt(x, z, body.radius)) return false;
  for (const box of boxes) {
    const dx = Math.max(box.minX - x, 0, x - box.maxX);
    const dz = Math.max(box.minZ - z, 0, z - box.maxZ);
    if (Math.hypot(dx, dz) + CONTACT_EPSILON < body.radius) return false;
    if (body.radius === 0 && x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ)
      return false;
  }
  for (const occupant of occupants) {
    if (occupant.id === body.id) continue;
    if (
      Math.hypot(x - occupant.x, z - occupant.z) + CONTACT_EPSILON <
      body.radius + occupant.radius
    )
      return false;
  }
  return true;
}

/**
 * Moves a non-overlapping body in steps of at most 0.06 world units, sliding X then Z if blocked.
 * blocked means some requested movement was denied. Zero motion is unblocked at a valid start.
 * Invalid motion or an occupied start stays put and reports blocked; no other body is pushed.
 * The caller owns all inputs and applies the returned position; this function has no side effects.
 */
export function moveBody(body, dx, dz, boxes, occupants = []) {
  let x = body.x,
    z = body.z;
  if (!Number.isFinite(dx) || !Number.isFinite(dz) || !canOccupy(body, x, z, boxes, occupants))
    return { x, z, blocked: true };
  const distance = Math.hypot(dx, dz);
  if (!Number.isFinite(distance)) return { x, z, blocked: true };
  if (distance === 0) return { x, z, blocked: false };
  const steps = Math.ceil(distance / MAX_MOVE_STEP);
  const stepX = dx / steps,
    stepZ = dz / steps;
  let blocked = false;
  for (let step = 0; step < steps; step += 1) {
    const nextX = x + stepX,
      nextZ = z + stepZ;
    if (canOccupy(body, nextX, nextZ, boxes, occupants)) {
      x = nextX;
      z = nextZ;
      continue;
    }
    blocked = true;
    const previousX = x,
      previousZ = z;
    if (stepX !== 0 && canOccupy(body, nextX, z, boxes, occupants)) x = nextX;
    if (stepZ !== 0 && canOccupy(body, x, nextZ, boxes, occupants)) z = nextZ;
    if (x === previousX && z === previousZ) break;
  }
  return { x, z, blocked };
}
