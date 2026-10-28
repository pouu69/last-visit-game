const PHYSICAL_KEYS = {
  KeyW: 'w',
  KeyA: 'a',
  KeyS: 's',
  KeyD: 'd',
  KeyE: 'e',
};

// Physical keys keep movement and inspection available with a Korean IME or another layout.
export function museumKeyboardKey(event) {
  return PHYSICAL_KEYS[event.code] ?? event.key.toLowerCase();
}
