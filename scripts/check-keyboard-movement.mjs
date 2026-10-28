import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

async function startMuseumGame(page) {
  if (await page.locator('#start-game').isVisible()) {
    await page.locator('#start-game').click();
    if (await page.locator('.invitation-open').count()) {
      await page.locator('.invitation-open').click();
      await page.waitForFunction(() => document.querySelector('.invitation-open')?.hidden === true);
      await page.locator('.invitation-enter').click();
      await page.locator('.invitation-team-choice').first().click();
    } else {
      await page.locator('#team-buttons button').first().click();
    }
  } else {
    await page.locator('#team-buttons button').first().click();
  }
  await page.waitForFunction(() => !document.getElementById('game').hidden);
}

const load = createRequire(process.argv[3] ? resolve(process.argv[3], 'package.json') : import.meta.url);
const { chromium } = load('playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(process.argv[2] ?? 'http://127.0.0.1:5188');
  await startMuseumGame(page);
  await page.locator('#reading-controls [data-action="explore"]').click();
  await page.waitForFunction(() => window.museumDiagnostics?.().interactive);
  await page.waitForTimeout(650);
  const avatar = () => page.evaluate(() => window.museumDiagnostics().avatar);
  async function checkMovement(label, press, release, moving = true) {
    const before = await avatar();
    await press();
    await page.waitForTimeout(220);
    await release();
    const after = await avatar();
    const distance = Math.hypot(after.x - before.x, after.z - before.z);
    assert.ok(moving ? distance > 0.15 : distance < 0.01, `${label}: moved ${distance.toFixed(3)}`);
    await page.waitForTimeout(130);
    const stopped = await avatar();
    assert.ok(Math.hypot(stopped.x - after.x, stopped.z - after.z) < 0.01, `${label}: released keys stop movement`);
    console.log(`${label}: ${distance.toFixed(3)}`);
    return { x: after.x - before.x, z: after.z - before.z };
  }
  const directions = {};
  for (const code of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    directions[code] = await checkMovement(code, () => page.keyboard.down(code), () => page.keyboard.up(code));
  }
  for (const [letter, arrow] of [['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown'], ['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']]) {
    assert.ok(directions[letter].x * directions[arrow].x + directions[letter].z * directions[arrow].z > 0, `${letter} agrees with ${arrow}`);
  }
  const dispatch = (type, key, code) => page.evaluate(({ type, key, code }) => {
    document.activeElement.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true, isComposing: true }));
  }, { type, key, code });
  for (const [key, code] of [['ㅈ', 'KeyW'], ['ㄴ', 'KeyS'], ['ㅁ', 'KeyA'], ['ㅇ', 'KeyD']]) {
    await checkMovement(`Korean ${code}`, () => dispatch('keydown', key, code), () => dispatch('keyup', key, code));
  }
  // Camera/HUD buttons must not strand keyboard movement until the floor is clicked.
  await page.locator('#camera-toggle').click();
  await checkMovement('after camera button', () => page.keyboard.down('KeyD'), () => page.keyboard.up('KeyD'));
  await page.locator('#camera-toggle').click();
  await checkMovement('after closing camera controls', () => page.keyboard.down('KeyA'), () => page.keyboard.up('KeyA'));
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'qa-keyboard-input';
    document.body.append(input);
    input.focus();
  });
  await checkMovement('text input blocks movement', () => page.keyboard.down('KeyD'), () => page.keyboard.up('KeyD'), false);
  assert.equal(await page.locator('#qa-keyboard-input').inputValue(), 'd');
  await page.locator('#qa-keyboard-input').evaluate((input) => input.remove());
  await page.locator('#menu-toggle').click();
  await checkMovement('menu blocks movement', () => page.keyboard.down('KeyD'), () => page.keyboard.up('KeyD'), false);
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  console.log('Keyboard movement checks passed.');
} finally {
  await browser.close();
}
