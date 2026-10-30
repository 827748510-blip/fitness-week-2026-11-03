// The review server itself must isolate data and mock sync, before any test route.
// Run scripts/serve-review.py and then this file through playwright-cli.
async (page) => {
  const context=await page.context().browser().newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const test=await context.newPage(),external=[];
  const check=(ok,msg)=>{if(!ok) throw new Error(msg);};
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin==='http://127.0.0.1:18742') return route.continue();
    external.push(url.hostname);return route.abort();
  });
  try {
    await test.goto('http://127.0.0.1:18742/');
    check(await test.locator('[role="note"]').textContent()!=='','review banner');
    check(await test.locator('#days .guide').count()===3,'review guides');
    await test.evaluate(()=>window.TrainingWorkspace.navigate('week'));
    await test.locator('.ov-check input').first().check();
    await test.locator('.ov-weight input').first().fill('66.6');
    await test.waitForFunction(()=>document.querySelector('#syncHint').textContent.includes('模拟成功（未上传）'));
    check(await test.evaluate(()=>!localStorage.getItem('fitness-tracker-v2')),'production key untouched');
    check(await test.evaluate(()=>JSON.parse(localStorage.getItem('fitness-review-v2')).days['2026-11-03'].weight)==='66.6','isolated review record');
    check(await test.evaluate(()=>SYNC.putUrl==='https://sync.invalid/review' && SYNC.editToken==='review-only-not-a-real-credential'),'production credential removed');
    check(external.length===0,'review mock requires no external network');
    await test.reload();
    check(await test.locator('.ov-weight input').first().inputValue()==='66.6','review reload retained');
    check((await test.request.get('http://127.0.0.1:18742/.git/config')).status()===404,'repository internals hidden');
    check((await test.request.get('http://127.0.0.1:18742/data/latest.json')).status()===404,'synced snapshots hidden');
    check((await test.request.get('http://127.0.0.1:18742/sw.js')).status()===404,'review worker disabled');
    check((await test.request.get('http://127.0.0.1:18742/images/%252e%252e/index.html')).status()===404,'encoded asset traversal rejected');
    await test.screenshot({path:'output/playwright/stage-safe-review.png'});
    await page.evaluate(r=>{globalThis.fitnessReviewReport=r;},{result:'PASS',externalRequestsAllowed:0,checks:['isolated records','credentials replaced','mock sync with no network','reload','restricted static routes']});
  } finally {await context.close();}
}
