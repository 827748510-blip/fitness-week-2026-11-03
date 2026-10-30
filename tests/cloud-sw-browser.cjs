// Real Chromium Service Workers, isolated loopback server, synthetic user data.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),origin='http://127.0.0.1:18743';
const baseline='279df14d86c5b50a0e9753cb5e94e1f81838d12e';
const legacy={html:execFileSync('git',['show',baseline+':index.html'],{cwd:root}),sw:execFileSync('git',['show',baseline+':sw.js'],{cwd:root})};
let current=false;
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,origin).pathname),relative=pathname==='/'?'index.html':pathname.slice(1);
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+'/')||relative.startsWith('.git')||relative.startsWith('data/')||relative==='synced.json'){res.writeHead(404).end();return;}
  let body;
  if(!current&&relative==='index.html')body=legacy.html;
  else if(!current&&relative==='sw.js')body=legacy.sw;
  else {try{body=fs.readFileSync(file);}catch{res.writeHead(404).end();return;}}
  res.writeHead(200,{'Content-Type':mime[path.extname(relative)]||'application/octet-stream','Cache-Control':'no-store','Service-Worker-Allowed':'/'});res.end(body);
});
(async()=>{
  await new Promise(resolve=>server.listen(18743,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'}),errors=[],external=[];
  await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(url.origin===origin&&req.method()==='GET')return route.continue();external.push(url.origin);if(url.hostname==='api.jstash.app'&&req.method()==='PUT')return route.fulfill({status:200,contentType:'application/json',body:'{}'});return route.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const checks=[];
  try{
    await page.goto(origin);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller);
    await page.evaluate(()=>{
      const snapshot=JSON.parse(JSON.stringify(state));snapshot.days['2026-11-03'].weight='77.7';snapshot.days['2026-11-03'].exercises.a_row.actual='20kg';
      localStorage.setItem('fitness-tracker-v2',JSON.stringify(snapshot));
      localStorage.setItem('fitness-session-v1',JSON.stringify({version:1,date:'2026-11-03',exercise:'a_row',sessions:{'2026-11-03:a_row':{sets:[{kg:20,reps:12,at:'2026-10-30T00:00:00Z'}],kg:'20',reps:'12'}}}));
      return caches.open('unrelated-user-cache').then(c=>c.put('/foreign',new Response('preserved')));
    });
    const before=await page.evaluate(()=>localStorage.getItem('fitness-tracker-v2'));
    assert((await page.evaluate(()=>caches.keys())).some(k=>!k.includes('v12-static-gallery')&&k.startsWith('fitness-week-')));checks.push('legacy worker installed against actual rollback baseline');
    current=true;
    await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));await reg.update();await changed;});
    await page.waitForFunction(async()=>{const reg=await navigator.serviceWorker.getRegistration();return reg?.active?.state==='activated'&&(await caches.keys()).some(k=>k.endsWith('v12-static-gallery'));});
    await page.waitForFunction(async()=>(await caches.keys()).filter(k=>k.startsWith('fitness-week-')).length===1);
    await page.reload();await page.locator('#trainingWorkspace').waitFor();
    assert.equal(await page.locator('meta[name="fitness-release"]').getAttribute('content'),'2026-10-30-gallery-v12');
    assert.equal(await page.evaluate(()=>localStorage.getItem('fitness-tracker-v2')),before);
    assert.equal(await page.evaluate(()=>TrainingWorkspace.exportData().sessions['2026-11-03:a_row'].sets.length),1);
    assert((await page.evaluate(()=>caches.keys())).includes('unrelated-user-cache'));checks.push('current worker replaces old cache and preserves primary records, group sidecar and foreign cache');
    await page.locator('#trainingWorkspace .reference-gallery img').evaluate(img=>img.decode());
    await page.waitForFunction(async()=>{const c=await caches.open('fitness-week-2026-11-03-v12-static-gallery');return !!await c.match('/assets/reference/F06-pose-thumb.webp');});
    const cached=await page.evaluate(async()=>{const c=await caches.open('fitness-week-2026-11-03-v12-static-gallery');return(await c.keys()).map(k=>new URL(k.url).pathname);});
    assert(cached.includes('/references.js')&&cached.includes('/reference-data.js')&&cached.includes('/references.css'));
    assert(!cached.some(p=>p.includes('-full.webp')));assert(cached.filter(p=>p.includes('/assets/reference/')).length<4);checks.push('core reference code precached; no gallery bulk download or full images prefetched');
    await context.setOffline(true);await page.reload();await page.locator('#trainingWorkspace').waitFor();
    await page.locator('#trainingWorkspace .reference-gallery img').evaluate(img=>img.decode());
    assert.equal(await page.evaluate(()=>state.days['2026-11-03'].weight),'77.7');assert.equal(await page.evaluate(()=>TrainingWorkspace.exportData().sessions['2026-11-03:a_row'].sets.length),1);checks.push('real offline reload restores workspace, visited preview and training data');
    await page.locator('#trainingWorkspace [data-reference-kind="muscle"]').click();await page.locator('#trainingWorkspace .reference-image-error').waitFor();
    assert((await page.locator('.work-reference-cues').textContent()).length>5);checks.push('unvisited image offline shows failure and retains text guidance');
    await context.setOffline(false);await page.locator('#trainingWorkspace [data-reference-retry]').click();await page.locator('#trainingWorkspace .reference-gallery img').evaluate(img=>img.decode());
    assert.equal(errors.length,0,errors.join(';'));assert(external.every(host=>host==='https://api.jstash.app'));checks.push('reconnection image retry; no external data read or real sync write');
    const report={result:'PASS',baseline,release:'2026-10-30-gallery-v12',checks,errors,realExternalTraffic:0,worker:'real Chromium',iOSSafari:'not tested'};
    fs.writeFileSync(path.join(root,'output/playwright/cloud-sw-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
  }catch(error){console.error(error.stack);console.error(JSON.stringify({errors,url:page.url(),html:(await page.content()).slice(-1200)}));process.exitCode=1;}
  finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
})();
