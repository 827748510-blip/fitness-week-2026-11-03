// Cloud browser QA. Only synthetic records; every external request is blocked.
async(page)=>{
  const context=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const test=await context.newPage(),errors=[],external=[],requested=[],checks=[];
  await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(url.origin==='http://127.0.0.1:18742'&&req.method()==='GET'){requested.push(url.pathname);return route.continue();}external.push(url.origin);return route.abort();});
  test.on('pageerror',e=>errors.push(e.message));
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const core=()=>test.evaluate(()=>JSON.stringify(state));
  try{
    await test.goto('http://127.0.0.1:18742/');const before=await core();
    const root=test.locator('#trainingWorkspace .reference-gallery');
    assert(await test.locator('video, #trainingWorkspace canvas').count()===0,'static references, no video or canvas dependency');
    assert(requested.filter(p=>p.includes('/assets/reference/')).every(p=>p.includes('F06-pose-thumb')),'initial visit loads only active preview');
    assert(!requested.some(p=>p.includes('-full.')),'no clear image preloaded');
    for(const width of [320,360,390,430,844,1440]){
      await test.setViewportSize({width,height:width===844?390:844});
      assert(await test.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no overflow at ${width}`);
    }
    await test.setViewportSize({width:390,height:844});
    await root.locator('[data-reference-kind="muscle"]').click();
    assert((await root.locator('img').getAttribute('src')).includes('F06-muscle-thumb'),'muscle selected');
    await root.locator('img').focus();await test.keyboard.press('Enter');
    await test.locator('#lightbox.open').waitFor();
    await test.keyboard.press('Tab');assert(await test.locator('[data-reference-zoom]').evaluate(el=>el===document.activeElement),'detail zoom in keyboard focus loop');
    await test.keyboard.press('Tab');assert(await test.locator('#lightboxClose').evaluate(el=>el===document.activeElement),'close in keyboard focus loop');
    assert((await test.locator('#lightboxImg').getAttribute('src')).includes('F06-muscle-full'),'clear image loaded on open');
    await test.locator('[data-reference-zoom]').click();
    assert(await test.locator('#lightbox').evaluate(el=>el.classList.contains('reference-zoomed')),'detail zoom stays open');
    assert(await test.locator('#lightbox').evaluate(el=>el.scrollWidth>innerWidth),'detail image can pan horizontally');
    await test.keyboard.press('Escape');
    assert(await root.locator('img').evaluate(el=>el===document.activeElement),'close restores image focus');
    assert(await core()===before,'gallery never marks completion');checks.push('lazy preview, tabs, clear image, detail zoom, focus, no training writes');
    await test.locator('[data-pick-ex="a_legpress"]').click();
    assert((await root.textContent()).includes('待确认'),'F01 pending visible');
    await root.locator('select').selectOption('F02');assert(!(await root.textContent()).includes('待确认 ·'),'F02 does not inherit F01 pending status');
    await test.locator('[data-pick-ex="a_arms"]').click();await root.locator('select').selectOption('F09');
    assert((await root.locator('img').getAttribute('src')).includes('F09-pose-thumb'),'supergroup second movement available');
    await test.getByRole('button',{name:'动作图集 · 32',exact:true}).click();
    const library=test.locator('#referenceLibrary');
    assert(await library.locator('option').count()===32,'all 32 catalog actions');
    const initialGalleryRecords=await core();
    const pending=[];
    for(const id of await library.locator('option').evaluateAll(options=>options.map(o=>o.value))){
      await library.locator('select').selectOption(id);
      await library.locator('[data-reference-kind="pose"]').click();
      await library.locator('img').evaluate(img=>img.decode());
      if((await library.locator('.reference-status').textContent()).includes('待确认'))pending.push(id);
      await library.locator('[data-reference-kind="muscle"]').click();await library.locator('img').evaluate(img=>img.decode());
      if(id==='F20')assert((await library.locator('.reference-warning').textContent()).includes('起始位'),'F20 start only');
    }
    assert(JSON.stringify(pending)===JSON.stringify(['F01','F04','F14','F24','F26','F27']),'exactly six pending pose sheets');
    assert(await core()===initialGalleryRecords,'full catalog browsing never edits records');checks.push('all 64 previews decoded; all variants; six pending poses; F20 scope');
    await library.locator('img').click();await test.locator('#lightbox.open').waitFor();await test.keyboard.press('Escape');assert(await library.isVisible(),'return from image retains library');
    await test.keyboard.press('Escape');assert(await library.isHidden(),'Escape returns to training');
    assert(await test.evaluate(()=>document.body.style.overflow===''),'body scroll restored');assert(await test.locator('.wrap').evaluate(el=>!el.inert),'workspace reenabled');
    // A failed image leaves clear guidance and a working retry action.
    await context.route('**/F09-pose-thumb.webp?synthetic-failure',route=>route.abort());
    await root.locator('[data-reference-kind="muscle"]').click();await root.locator('[data-reference-kind="pose"]').click();
    await root.locator('img').evaluate(img=>{img.src+='?synthetic-failure';});
    await root.locator('.reference-image-error').waitFor();
    assert((await test.locator('.work-reference-cues').textContent()).length>5,'training text survives image failure');
    await context.unroute('**/F09-pose-thumb.webp?synthetic-failure');await root.locator('[data-reference-retry]').click();await root.locator('img').evaluate(img=>img.decode());
    assert(await root.locator('.reference-image-error').isHidden(),'image retry succeeds');checks.push('nested overlay return, scroll restore, image failure and retry');
    await test.locator('[data-view="week"]').click();
    const detail=test.locator('#day-2026-11-03 .reference-details').first();await detail.locator(':scope > summary').click();await detail.locator('img').evaluate(img=>img.decode());
    assert(await detail.locator('img').count()===1,'week cards use lazy gallery');
    await test.locator('[data-view="train"]').click();await test.locator('[data-pick-ex="a_row"]').click();
    await test.screenshot({path:'output/playwright/gallery-mobile.png',fullPage:true});
    await test.setViewportSize({width:1440,height:1000});await test.screenshot({path:'output/playwright/gallery-desktop.png',fullPage:true});
    assert(errors.length===0,'no runtime errors: '+errors.join(';'));assert(external.length===0,'no live requests');
    await page.evaluate(report=>globalThis.fitnessGalleryReport=report,{result:'PASS',checks,pending,previewImages:64,externalRequestsAllowed:0,widths:[320,360,390,430,844,1440]});
  }finally{await context.close();}
}
