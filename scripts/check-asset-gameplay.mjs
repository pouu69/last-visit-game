import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startMuseumGame } from './browser-game-entry.mjs';

// Uses rendered controls, floor clicks, E and the real game session. No state is injected.
const base = process.argv[2] ?? 'http://127.0.0.1:5197';
const output = resolve(process.argv[3] ?? 'artifacts/asset-gameplay');
const load = createRequire(process.argv[4] ? resolve(process.argv[4], 'package.json') : import.meta.url);
const { chromium } = load('playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const samples = [], errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await mkdir(output, { recursive: true });
try {
  await page.goto(base);
  await startMuseumGame(page);
  await page.evaluate(async () => {
    const { createLocalSessions } = await import('./src/local-sessions.mjs');
    const reader = createLocalSessions({ storage: localStorage });
    const sessionId = JSON.parse(localStorage.getItem('museum-local-sessions-v1'))['1'];
    Object.defineProperty(window, 'qaView', { get: () => reader.get(sessionId).view });
  });
  const driver = (await readFile(new URL('./investigation-browser-driver.js', import.meta.url), 'utf8')).trim().replace(/;$/, '');
  await page.evaluate(`(${driver})()`);
  async function sample(stage) {
    const value = await page.evaluate(() => ({ sceneId:window.qaView.sceneId, phase:window.qaView.phase, observations:window.qaView.observations, diagnostics:window.museumDiagnostics() }));
    assert.ok(value.diagnostics.collision.bodies.every((body) => body.clear), `${stage}: body clearance`);
    samples.push({ stage, ...value });
    process.stdout.write(`${stage}: ${value.sceneId}/${value.phase}\n`);
  }
  async function walk(x, z, arrivalRoom = null) {
    const screen = await page.evaluate(async ({x,z}) => {
      const T = await import('./vendor/three.module.js');
      const d = window.museumDiagnostics(), hh = (d.cameraFrustum.top-d.cameraFrustum.bottom)/2;
      const c = new T.OrthographicCamera(-hh*d.width/d.height, hh*d.width/d.height, d.cameraFrustum.top, d.cameraFrustum.bottom, .1, 100);
      c.position.fromArray(d.cameraPosition); c.zoom=d.cameraZoom;
      c.lookAt(new T.Vector3(...d.cameraTarget)); c.updateProjectionMatrix(); c.updateMatrixWorld(true);
      const p = new T.Vector3(x,.04,z).project(c), r=document.querySelector('#museum-stage canvas').getBoundingClientRect();
      return {x:r.x+(p.x+1)*d.width/2,y:r.y+(1-p.y)*d.height/2};
    }, {x,z});
    assert.ok(screen.x>0 && screen.x<1440 && screen.y>86 && screen.y<970, 'floor waypoint must be in viewport');
    await page.mouse.click(screen.x,screen.y);
    await page.waitForTimeout(250);
    await page.waitForFunction(()=>window.museumDiagnostics().avatar.waypoints===0,null,{timeout:15000});
    await page.waitForTimeout(180);
    const d=await page.evaluate(()=>window.museumDiagnostics());
    assert.ok((arrivalRoom && d.avatar.roomId === arrivalRoom) || Math.hypot(d.avatar.x-x,d.avatar.z-z)<0.8, `floor target was reached: ${x},${z}`);
  }
  async function inspect() {
    await page.locator('#museum-stage canvas').focus(); await page.keyboard.press('e');
    await page.waitForFunction(()=>window.qaView.phase==='reading');
    await page.evaluate(()=>window.investigationQA.read());
  }
  await page.waitForTimeout(650);
  await page.evaluate(() => window.investigationQA.field());
  await walk(0,16); await inspect(); await sample('invitation-inspected');
  assert.ok(samples.at(-1).observations.some((o)=>o.id==='invitation'));
  await page.evaluate(()=>window.investigationQA.field());
  await walk(-.5,17); await inspect(); await sample('curator-greeted');
  assert.ok(samples.at(-1).observations.some((o)=>o.id==='curator'));
  await page.evaluate(()=>window.investigationQA.field());
  // Departure now belongs to Yunseo's in-world prompt, reached by the prior walk.
  await page.locator('#museum-stage canvas').focus();
  await page.keyboard.press('e');
  await page.waitForFunction(()=>window.qaView.phase==='travelling');
  await sample('travel-start');
  await walk(0,9);
  await walk(0,4,'gallery');
  await page.waitForFunction(()=>window.qaView.currentRoomId==='gallery' && window.qaView.phase!=='travelling',null,{timeout:15000});
  await sample('gallery-arrival');
  await page.evaluate(()=>window.investigationQA.field());
  const initialCamera=await page.evaluate(()=>window.museumDiagnostics().cameraSettings);
  await page.locator('#camera-toggle').click();
  for(let i=0;i<6;i++) await page.locator('#camera-right').click();
  await page.locator('#camera-up').click();
  await page.waitForTimeout(250);
  const camera=await page.evaluate(()=>window.museumDiagnostics().cameraSettings);
  assert.equal(camera.yaw,initialCamera.yaw+90); assert.equal(camera.pitch,initialCamera.pitch+8);
  await sample('camera-rotated');
  await page.screenshot({path:resolve(output,'gameplay-rotated.png')});
  await page.locator('#camera-reset').click();
  await page.locator('#camera-toggle').click();
  await page.waitForTimeout(250);
  await page.screenshot({path:resolve(output,'gameplay-gallery.png')});
  assert.deepEqual(errors,[]);
} catch(error) {
  await page.screenshot({path:resolve(output,'failure.png')});
  throw error;
} finally {
  await writeFile(resolve(output,'report.json'),JSON.stringify({samples,errors},null,2));
  await browser.close();
}
