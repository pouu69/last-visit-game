import test from 'node:test';
import assert from 'node:assert/strict';
import { museumKeyboardKey } from '../public/museum-keyboard.mjs';

test('physical movement and inspection keys work during Korean composition', () => {
  for (const [code, key, expected] of [
    ['KeyW', 'ㅈ', 'w'], ['KeyA', 'ㅁ', 'a'], ['KeyS', 'ㄴ', 's'],
    ['KeyD', 'ㅇ', 'd'], ['KeyE', 'ㄷ', 'e'], ['KeyW', 'Process', 'w'],
  ]) {
    assert.equal(museumKeyboardKey({ code, key, isComposing: true }), expected);
  }
});

test('releasing a physical key still matches after the input language changes', () => {
  assert.equal(museumKeyboardKey({ code: 'KeyW', key: 'w' }), museumKeyboardKey({ code: 'KeyW', key: 'ㅈ' }));
});

test('arrow keys and key-only events retain their bindings', () => {
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'W', 'A', 'S', 'D', 'E']) {
    assert.equal(museumKeyboardKey({ key }), key.toLowerCase());
  }
});
