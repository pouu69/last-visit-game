import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Usage: node scripts/check-asset-visuals.mjs URL OUTPUT_DIR [PLAYWRIGHT_NODE_MODULES]
const base = process.argv[2] ?? 'http://127.0.0.1:5197';
const output = resolve(process.argv[3] ?? 'artifacts/asset-visuals');
const runtime = process.argv[4];
const load = createRequire(runtime ? resolve(runtime, 'package.json') : import.meta.url);
const { chromium } = load('playwright');
const browser = await chromium.launch({ headless: true });
const errors = [];
const report = { generatedAt: new Date().toISOString(), base, gallery: [], rooms: [], states: [], errors };
await mkdir(resolve(output, 'objects'), { recursive: true });
await mkdir(resolve(output, 'rooms'), { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/asset-gallery.html`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  const catalog = await page.evaluate(() => window.assetGallery.catalog);
  for (const entry of process.argv.includes('--rooms-only') ? [] : catalog) {
    await page.evaluate((id) => window.assetGallery.select(id), entry.id);
    for (const pitch of [25, 43, 70]) {
      for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
        const capture = await page.evaluate(({ yaw, pitch }) => {
          window.assetGallery.setCamera({ yaw, pitch, zoom: 1 });
          const source = document.querySelector('#stage canvas');
          const canvas = document.createElement('canvas');
          canvas.width = 288; canvas.height = 256;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#e4dfc8'; ctx.fillRect(0, 0, 288, 256);
          const ratio = Math.min(288 / source.width, 256 / source.height);
          const w = source.width * ratio, h = source.height * ratio;
          ctx.drawImage(source, (288 - w) / 2, (256 - h) / 2, w, h);
          return { image: canvas.toDataURL('image/png').split(',')[1], diagnostics: window.assetGallery.diagnostics() };
        }, { yaw, pitch });
        const path = `objects/${entry.id}-y${yaw}-p${pitch}.png`;
        await writeFile(resolve(output, path), Buffer.from(capture.image, 'base64'));
        report.gallery.push({ id: entry.id, yaw, pitch, path, ...capture.diagnostics });
      }
    }
    process.stdout.write(`Captured ${entry.id}\n`);
  }
  report.scale=[];
  for(const id of ['moro','paper-boat','curator','exhibit-case']) for(const zoom of [.6,1,1.8]) {
    await page.evaluate(({id,zoom})=>{window.assetGallery.select(id);window.assetGallery.setCamera({yaw:35,pitch:43,zoom});},{id,zoom});
    const path=`scale-${id}-${zoom}.png`;
    await page.screenshot({path:resolve(output,path)});
    report.scale.push({id,zoom,path,diagnostics:await page.evaluate(()=>window.assetGallery.diagnostics())});
  }
  await page.evaluate(() => { window.assetGallery.select('moro'); window.assetGallery.setCamera({ yaw: 35, pitch: 43 }); });
  await page.screenshot({ path: resolve(output, 'gallery.png') });
  // Mount the production scene with deterministic public snapshots, without mutating saved playthroughs.
  await page.evaluate(async () => {
    window.assetGallery.dispose();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;background:#132c34';
    const stage = document.createElement('div');
    stage.style.cssText = 'width:1200px;height:900px';
    document.body.append(stage);
    const { mountMuseum } = await import('./museum-scene.mjs');
    window.assetSceneEvents = [];
    window.assetScene = mountMuseum(stage, {
      onInspect: (id) => window.assetSceneEvents.push({ type: 'inspect', id }),
      onArrive: (id) => window.assetSceneEvents.push({ type: 'arrive', id }),
    });
  });
  const rooms = [
    ['gallery','S01'], ['maintenance','I01'], ['archive','I02'], ['garden','I03'],
    ['office','I04'], ['return','D21'], ['control','P21'], ['foyer','P12'], ['reception','S31'],
  ];
  for (const [roomId, sceneId] of rooms) {
    const flags = { boat: sceneId === 'S31' ? 'intact' : 'locked', record: sceneId === 'S31' ? 'intact' : 'locked', moro: 'active', crane: 'stable', maintenance: true };
    await page.evaluate(({ roomId, sceneId, flags }) => {
      window.assetScene.update({ sceneId, storyVersion: 'museum-map-4', mode:'map', currentRoomId:roomId,
        playthroughId:`asset-qa-${roomId}`, phase:'exploring', flags, travel:null,
        speaker:null, messageId:`qa-${roomId}`, hotspots:[], activeHotspot:null, interactive:true });
    }, { roomId, sceneId, flags });
    for (const pitch of [25,43,70]) for (const yaw of [0,90,180,270]) {
      await page.evaluate(({yaw,pitch})=>{const d=window.assetScene.diagnostics();window.assetScene.adjustCamera({yawDelta:yaw-d.cameraSettings.yaw,pitchDelta:pitch-d.cameraSettings.pitch,zoomFactor:1/d.cameraSettings.zoom});},{yaw,pitch});
      await page.waitForTimeout(70);
      const path=`rooms/${roomId}-y${yaw}-p${pitch}.png`;
      await page.screenshot({path:resolve(output,path)});
      report.rooms.push({roomId,sceneId,yaw,pitch,path,diagnostics:await page.evaluate(()=>window.assetScene.diagnostics())});
    }
    process.stdout.write(`Captured room ${roomId}\n`);
  }
  for (const variant of [
    {id:'locked',roomId:'return',sceneId:'D21',boat:'locked',record:'locked',moro:'active'},
    {id:'damaged',roomId:'return',sceneId:'R31',boat:'damaged',record:'unreadable',moro:'asleep'},
    {id:'sealed',roomId:'return',sceneId:'R32',boat:'sealed',record:'sealed',moro:'asleep'},
    {id:'recovered',roomId:'reception',sceneId:'S31',boat:'intact',record:'intact',moro:'active'},
  ]) {
    await page.evaluate((v)=>{window.assetScene.update({sceneId:v.sceneId,storyVersion:'museum-map-4',mode:'map',currentRoomId:v.roomId,playthroughId:`state-${v.id}`,phase:'exploring',flags:{boat:v.boat,record:v.record,moro:v.moro,crane:'stalled'},travel:null,speaker:null,messageId:v.id,hotspots:[],activeHotspot:null,interactive:true});window.assetScene.resetCamera();window.assetScene.focus(v.roomId==='return'?'boat':'packing');},variant);
    await page.waitForTimeout(90);
    const path=`state-${variant.id}.png`;
    await page.screenshot({path:resolve(output,path)});
    report.states.push({...variant,path,diagnostics:await page.evaluate(()=>window.assetScene.diagnostics())});
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(()=>window.assetScene.update({sceneId:'S01',storyVersion:'museum-map-4',mode:'map',currentRoomId:'gallery',playthroughId:'motion',phase:'reading',flags:{boat:'locked',record:'locked',moro:'active'},travel:null,speaker:'윤서',messageId:'motion-check',hotspots:[{id:'moro',anchor:'moro',label:'모로'}],activeHotspot:null,interactive:false}));
  report.motion=[];
  for(let i=0;i<7;i++){ await page.waitForTimeout(160); report.motion.push(await page.evaluate(()=>window.assetScene.diagnostics())); }
  if(new Set(report.motion.map(d=>d.poses.moroTilt)).size<2)throw new Error('Awake robot pose did not animate');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(80);
  report.reducedMotion=await page.evaluate(()=>window.assetScene.diagnostics());
  if(report.reducedMotion.poses.moroTilt!==0 || report.reducedMotion.poses.antenna!==0)throw new Error('Reduced motion did not reset decorative poses');
  await page.evaluate(()=>window.assetScene.dispose());
  await page.goto(base);
  await page.locator('#team-buttons button').first().click();
  await page.waitForFunction(()=>!document.getElementById('game').hidden);
  await page.screenshot({path:resolve(output,'game-introduction.png')});
  report.app = {text:(await page.locator('body').innerText()).slice(0,1800),diagnostics:await page.evaluate(()=>window.museumDiagnostics())};
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
} finally {
  await writeFile(resolve(output,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  await browser.close();
}
process.stdout.write(`Saved ${report.gallery.length} object views and ${report.rooms.length} room views.\n`);
