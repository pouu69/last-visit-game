import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {createSeries,dispatchSeries,saveSeries} from '../../src/series-state.mjs';
const require=createRequire('/Users/kwanung/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
let state=createSeries({sceneId:'E5',flags:{boat:'sealed',record:'unreadable',moro:'asleep'}},{moroAccompanies:false});
state=dispatchSeries(state,{type:'explore',target:'A'});
for(const choice of ['A','B','B','A'])state=dispatchSeries(state,{type:'choose',choice});
const saved=saveSeries(state), browser=await chromium.launch({channel:'chromium',headless:true});
const page=await browser.newPage({viewport:{width:800,height:600}}), errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/qa-save',route=>route.fulfill({contentType:'text/html',body:'<html><head><link rel="stylesheet" href="/series-game.css"></head><body></body></html>'}));
await page.goto('http://127.0.0.1:5188/qa-save');
const result={};
try{
 await page.evaluate(async()=>{localStorage.setItem('return-path-series-v2:qa-save','broken-json');window.qa=await(await import('/series-game.mjs')).mountSeriesGame({museumView:{sceneId:'E1',flags:{}},sessionId:'qa-save',storage:localStorage});});
 result.warningVisible=await page.getByText('자동 저장 기록이 손상됐습니다.',{exact:false}).isVisible();
 await page.locator('.series-menu').getByRole('button',{name:'기록 불러오기'}).click();
 await page.locator('.series-game input[type=file]').setInputFiles({name:'saved.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
 await page.waitForFunction(()=>window.qa.diagnostics().view?.episodeId===4);
 result.restored=await page.evaluate(()=>({episode:qa.diagnostics().view.episodeId,stage:qa.diagnostics().view.stage,revision:qa.diagnostics().view.revision,record:qa.diagnostics().view.museum.flags.record}));
 if(!result.warningVisible||result.restored.stage!=='perform'||result.restored.record!=='unreadable')throw Error('Recovery invariant failed');
 await page.screenshot({path:'artifacts/series-integration-qa/save-recovery.png'});
}catch(error){errors.push(error.stack);}
await writeFile('artifacts/series-integration-qa/save-recovery.json',JSON.stringify({result,errors},null,2));
console.log(JSON.stringify({result,errors}));await browser.close();if(errors.length)process.exitCode=1;
