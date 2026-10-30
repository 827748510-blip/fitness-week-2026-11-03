// Local-only browser checks. Synthetic records; all external traffic intercepted.
// Serve this checkout on 127.0.0.1:18741, then use playwright-cli run-code.
async (page) => {
  const context = await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block',reducedMotion:'no-preference'});
  const test = await context.newPage(), uploads=[], errors=[], blocked=[];
  const check=(ok,msg)=>{if(!ok) throw new Error(msg);};
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin==='http://127.0.0.1:18741' && req.method()==='GET') return route.continue();
    if(url.href==='https://sync.invalid/cloud-write-disabled' && req.method()==='PUT') {
      uploads.push(req.postDataJSON());return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    }
    blocked.push(url.hostname);return route.abort();
  });
  test.on('pageerror',error=>errors.push(error.message));
  const row=()=>test.locator('#days [data-exercise="a_row"]');
  try {
    await test.goto('http://127.0.0.1:18741/');
    await test.evaluate(()=>window.TrainingWorkspace?.navigate('week'));
    await test.getByRole('heading',{name:'健身周计划',exact:true}).waitFor();
    check(await test.locator('#days .guide').count()===3,'exactly three animated samples');
    check(await test.locator('.hero-scene svg').count()===1,'original hero present');
    check(await test.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px overflow');
    await test.screenshot({path:'output/playwright/stage-mobile-home.png'});
    const before=await test.evaluate(()=>JSON.stringify(state));
    await row().scrollIntoViewIfNeeded();
    await test.waitForFunction(()=>Number(document.querySelector('#days [data-exercise="a_row"] .guide-scrub').value)>50);
    await row().getByRole('button',{name:'0.5× 慢放',exact:true}).click();
    check(await row().getByRole('button',{name:'0.5× 慢放'}).getAttribute('aria-pressed')==='true','half speed preference');
    await row().getByRole('button',{name:'暂停示范',exact:true}).click();
    const paused=await row().locator('.guide-scrub').inputValue();
    await test.waitForTimeout(150);check(await row().locator('.guide-scrub').inputValue()===paused,'pause holds pose');
    await row().getByRole('button',{name:'下一步动作阶段'}).click();
    check(await row().locator('[data-phase-number]').textContent()!=='01 / 04','next stage');
    await row().locator('.guide-scrub').fill('460');
    check(await row().locator('[data-phase-name]').textContent()==='短暂停顿','scrub selects phase');
    await row().getByRole('button',{name:'上一步动作阶段'}).focus();
    await test.keyboard.press('Enter');check(await row().locator('[data-phase-name]').textContent()==='向后拉','keyboard step');
    await row().getByRole('button',{name:'开始休息 90 秒'}).click();
    check((await row().locator('.guide-rest-clock').textContent()).startsWith('1:'),'rest timer running');
    await row().getByRole('button',{name:'结束计时',exact:true}).click();
    check(await row().locator('.guide-rest-clock').textContent()==='','rest cancel');
    check(await test.evaluate(()=>JSON.stringify(state))===before,'guide controls never change training records');
    check(uploads.length===0,'guide controls never sync');
    await row().scrollIntoViewIfNeeded();await test.screenshot({path:'output/playwright/stage-mobile-row.png'});
    await row().screenshot({path:'output/playwright/stage-mobile-row-card.png'});
    const chest=test.locator('#days [data-exercise="a_chest"]');
    await chest.getByRole('combobox',{name:'胸推动作变式'}).selectOption('smith');
    check(await chest.locator('.guide-animation').isHidden(),'smith does not reuse machine animation');
    check(await chest.locator('.guide-source').isHidden(),'smith hides machine source link');
    check(await chest.locator('.guide-static').isVisible(),'smith missing-guide notice');
    check(await chest.locator('.guide-static img').count()===0,'machine photo is never relabeled as smith');
    await chest.getByRole('combobox',{name:'胸推动作变式'}).selectOption('machine');
    check(await chest.locator('.guide-animation').isVisible(),'machine demo restores');
    check(await chest.locator('.guide-source').isVisible(),'machine source link restores');
    await chest.locator('.guide-scrub').fill('460');await chest.scrollIntoViewIfNeeded();
    await test.screenshot({path:'output/playwright/stage-mobile-chest.png'});
    const lateral=test.locator('#days [data-exercise="c_lateral"]');
    await lateral.locator('.guide-scrub').fill('460');await lateral.scrollIntoViewIfNeeded();
    await test.screenshot({path:'output/playwright/stage-mobile-lateral.png'});
    await test.emulateMedia({reducedMotion:'reduce'});
    check(await row().getByRole('button',{name:'分步查看'}).isDisabled(),'system reduced motion stops continuous playback');
    await row().getByRole('button',{name:'下一步动作阶段'}).click();
    await test.emulateMedia({reducedMotion:'no-preference'});
    await test.locator('#motionSetting').click();
    check(await row().getByRole('button',{name:'分步查看'}).isDisabled(),'local reduce motion preference');
    await test.locator('#motionSetting').click();
    // A synthetic record still travels through the original sync protocol.
    await test.locator('.ov-check input').first().check();
    await test.locator('.ov-weight input').first().fill('77.7');
    await test.locator('#day-2026-11-03 [data-ex="a_row"] input[type="text"]').fill('42kg');
    await test.waitForFunction(()=>document.querySelector('#syncHint').textContent.includes('已上传给教练'));
    check(uploads.length>0,'manual records sync to mock');
    const payload=uploads.at(-1);
    check(payload.state.days['2026-11-03'].exercises.a_row.actual==='42kg','original actual text');
    check(payload.state.liftLog.find(e=>e.exerciseId==='a_row').kg===42,'weight statistics preserved');
    check(!JSON.stringify(payload).includes('fitness-guide-preferences'),'guide preferences not in payload');
    check((await test.locator('[data-week-number]').textContent())==='1','feedback reflects actual day confirmation');
    // Export is still v2 and import keeps history; intercept only native dialogs/downloads.
    await test.getByText('同步、备份与安装',{exact:true}).click();
    test.once('dialog',d=>d.accept());
    const downloadPromise=test.waitForEvent('download');
    await test.getByRole('button',{name:'导出备份',exact:true}).click();
    const download=await downloadPromise;
    check(download.suggestedFilename()==='fitness-week-2026-11-03-export.json','export filename');
    const exported=await test.evaluate(()=>({state:JSON.parse(localStorage.getItem('fitness-tracker-v2'))}));
    exported.state.weeks['2026-10-27']={days:{'2026-10-27':{done:true,weight:'88.8'}}};
    const importDialogs=[];
    const handleImport=async dialog=>{
      importDialogs.push(dialog.type());
      if(dialog.type()==='prompt') await dialog.accept(JSON.stringify(exported));
      else await dialog.accept();
    };
    test.on('dialog',handleImport);
    await test.getByRole('button',{name:'导入备份',exact:true}).click();
    await test.waitForFunction(()=>!!state.weeks['2026-10-27']);
    test.off('dialog',handleImport);
    check(importDialogs.includes('prompt') && importDialogs.includes('alert'),'import prompt and confirmation');
    check(await test.evaluate(()=>state.weeks['2026-10-27'].days['2026-10-27'].done),'import preserves history');
    check(await test.locator('#days .guide').count()===3,'players remount after import');
    await test.evaluate(()=>window.TrainingWorkspace.navigate('stats'));
    check((await test.locator('#completionBox').textContent()).includes('本周 1/7'),'stats records');
    await test.screenshot({path:'output/playwright/stage-mobile-stats.png'});
    await test.evaluate(()=>window.TrainingWorkspace.navigate('week'));
    await test.setViewportSize({width:1440,height:1000});
    check(await test.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'desktop overflow');
    await test.screenshot({path:'output/playwright/stage-desktop-home.png'});
    await row().locator('.guide-scrub').fill('460');await row().scrollIntoViewIfNeeded();
    await test.screenshot({path:'output/playwright/stage-desktop-row.png'});
    await test.locator('#motion-a_row').screenshot({path:'output/playwright/stage-desktop-row-card.png'});
    await test.setViewportSize({width:320,height:740});
    check(await test.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px overflow');
    await test.screenshot({path:'output/playwright/stage-small-mobile.png'});
    // Cloud boundary blocks live Service Workers; offline cache behavior is tested
    // separately in a VM with synthetic fetch/cache, never a live worker.
    check(errors.length===0,`browser errors: ${errors.join(',')}`);
    check(blocked.length===0,'no remote font, asset or renderer requests');
    await page.evaluate(report=>{globalThis.fitnessStageReport=report;},{result:'PASS',mockUploads:uploads.length,externalRequestsAllowed:0,checks:['3 explicit variants','play pause half speed','keyboard step and scrub','rest timer','no automatic records','manual sync and logs','export import','weekly feedback','320/390/1440 layout','reduced motion','live SW blocked; offline cache contract verified separately','local assets','no runtime errors']});
  } finally {await context.close();}
}
