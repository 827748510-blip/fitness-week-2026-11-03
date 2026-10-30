// Current cloud verification. Every context blocks SW and all external traffic.
async (page) => {
  const browser=page.context().browser(), results=[];
  async function scenario(name,run){
    const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},reducedMotion:'no-preference'});
    const errors=[],external=[];
    await context.route('**/*',route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.origin==='http://127.0.0.1:18742'&&req.method()==='GET'&&!/\/sw\.js$|\/data\/|synced\.json/.test(url.pathname))return route.continue();
      external.push(url.origin+url.pathname);return route.abort();
    });
    const test=await context.newPage();test.on('pageerror',e=>errors.push(e.message));
    const assert=(ok,message)=>{if(!ok)throw Error(message);};
    try{
      await test.goto('http://127.0.0.1:18742/');
      await run(test,assert,context);
      assert(errors.length===0,'runtime errors: '+errors.join('; '));assert(external.length===0,'unexpected network');
      results.push({name,status:'PASS',errors,external});
    }catch(e){await test.screenshot({path:'output/playwright/cloud-failure-'+name+'.png',fullPage:true}).catch(()=>{});results.push({name,status:'FAIL',error:e.message,errors,external});}
    finally{await context.close();}
  }
  await scenario('workspace-picture-keyboard',async(test,assert)=>{
    await test.locator('[data-pick-ex="a_legcurl"]').click();
    const image=test.locator('#trainingWorkspace .reference-gallery img');
    await image.focus();await image.press('Enter');
    assert(await test.locator('#lightbox').evaluate(el=>el.classList.contains('open')),'workspace reference image must open with Enter');
    await test.keyboard.press('Tab');assert(await test.locator('[data-reference-zoom]').evaluate(el=>el===document.activeElement),'zoom control reachable');await test.keyboard.press('Tab');assert(await test.locator('#lightboxClose').evaluate(el=>el===document.activeElement),'lightbox traps focus');
    await test.keyboard.press('Escape');assert(await image.evaluate(el=>el===document.activeElement),'Escape returns focus');
    await image.press('Space');assert(await test.locator('#lightbox').evaluate(el=>el.classList.contains('open')),'Space opens image');
    await test.locator('#lightboxClose').click();assert(await image.evaluate(el=>el===document.activeElement),'close button returns focus');
    await image.click();assert(await test.locator('#lightbox').evaluate(el=>el.classList.contains('open')),'click opens image');
  });
  await scenario('failed-storage-no-phantom-record',async(test,assert)=>{
    const before=await test.evaluate(()=>JSON.stringify(state));
    await test.locator('#setKg').fill('19');await test.locator('#setReps').fill('9');
    await test.evaluate(()=>{const set=Storage.prototype.setItem;window.__storageSet=set;Storage.prototype.setItem=function(key,value){if(key==='fitness-review-v2')throw new DOMException('synthetic full disk','QuotaExceededError');return set.call(this,key,value);};});
    await test.locator('[data-complete-set]').click();
    assert(await test.evaluate(()=>JSON.stringify(state))===before,'failed save must preserve original in-memory training state');
    assert(await test.evaluate(()=>TrainingWorkspace.exportData().sessions['2026-11-03:a_row'].sets.length)===0,'failed save must not keep a set');
    assert((await test.locator('#setError').textContent()).includes('保存失败'),'failed save explained');
  });
  await scenario('repeated-confirm-and-input-errors',async(test,assert)=>{
    const count=()=>test.evaluate(()=>TrainingWorkspace.exportData().sessions['2026-11-03:a_row'].sets.length);
    await test.locator('#setKg').fill('20');await test.locator('#setReps').fill('0');await test.locator('[data-complete-set]').click();assert(await count()===0,'zero reps rejected');
    await test.locator('#setReps').fill('10.5');await test.locator('[data-complete-set]').click();assert(await count()===0,'fraction reps rejected');
    await test.locator('#setReps').fill('12');await test.evaluate(()=>{const b=document.querySelector('[data-complete-set]');b.click();b.click();b.click();});assert(await count()===1,'repeated confirmation creates one set');
    await test.locator('#setReps').press('Enter');assert(await count()===1,'Enter during rest cannot create extra set');
    await test.locator('[data-end-rest]').click();await test.locator('[data-undo-set]').click();assert(await count()===0,'undo returns to zero');
    assert(await test.evaluate(()=>!state.days['2026-11-03'].done),'workbench does not confirm day');
  });
  await scenario('undo-storage-failure',async(test,assert)=>{
    await test.locator('#setKg').fill('20');await test.locator('#setReps').fill('12');
    for(let n=0;n<3;n++){await test.locator('[data-complete-set]').click();await test.locator('[data-end-rest]').click();}
    const before=await test.evaluate(()=>JSON.stringify(state)),sessions=await test.evaluate(()=>JSON.stringify(TrainingWorkspace.exportData()));
    await test.evaluate(()=>{const set=Storage.prototype.setItem;window.__storageSet=set;Storage.prototype.setItem=function(key,value){if(key==='fitness-review-v2')throw new DOMException('synthetic full disk','QuotaExceededError');return set.call(this,key,value);};});
    await test.locator('[data-undo-set]').click();
    assert(await test.evaluate(()=>JSON.stringify(state))===before,'failed undo must preserve confirmed training state');
    assert(await test.evaluate(()=>JSON.stringify(TrainingWorkspace.exportData()))===sessions,'failed undo must preserve completed sets');
    assert((await test.locator('#setError').textContent()).includes('撤销失败'),'undo failure explained');
    await test.evaluate(()=>Storage.prototype.setItem=window.__storageSet);
    await test.locator('[data-undo-set]').click();
    assert(await test.evaluate(()=>!state.days['2026-11-03'].exercises.a_row.done&&TrainingWorkspace.exportData().sessions['2026-11-03:a_row'].sets.length===2),'undo retry succeeds');
  });
  await scenario('all-pages-dates-widths-safe-area',async(test,assert)=>{
    // Test-only CSS substitutes safe-area env values; no physical notch claim.
    for(const [width,height] of [[360,800],[390,844],[430,932],[1440,1000]]){
      await test.setViewportSize({width,height});
      for(const view of ['train','week','stats']){
        await test.locator(`[data-view="${view}"]`).click();
        if(view==='train')for(const date of ['2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08','2026-11-09']){
          await test.locator(`[data-pick-date="${date}"]`).click();assert(await test.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${date} overflow`);
        }
        assert(await test.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${view} overflow`);
        await test.screenshot({path:`output/playwright/cloud-${view}-${width}.png`,fullPage:true});
      }
    }
    await test.setViewportSize({width:390,height:844});await test.locator('[data-view="train"]').click();
    await test.locator('[data-pick-date="2026-11-03"]').click();await test.locator('[data-pick-ex="a_row"]').click();
    await test.addStyleTag({content:'#workbenchNav{bottom:46px!important}#trainActionBar{bottom:118px!important}.workbench-enabled .wrap{padding-top:62px!important;padding-bottom:250px!important}'});
    const nav=await test.locator('#workbenchNav').boundingBox(),bar=await test.locator('#trainActionBar').boundingBox();assert(nav.y+nav.height<=810&&bar.y+bar.height<nav.y,'simulated 34px bottom safe area reserves nav and action space');
    await test.locator('#setKg').focus();await test.locator('#setKg').scrollIntoViewIfNeeded();
    assert(await test.locator('#setKg').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16),'mobile input prevents small-font zoom');
    await test.screenshot({path:'output/playwright/cloud-simulated-safe-area.png',fullPage:true});
  });
  await scenario('static-reference-navigation-no-records',async(test,assert)=>{
    const before=await test.evaluate(()=>JSON.stringify(state));
    assert(await test.locator('#trainingWorkspace canvas, #trainingWorkspace video').count()===0,'current workspace uses static references');
    await test.locator('#trainingWorkspace [data-reference-kind="muscle"]').click();
    await test.locator('[data-view="week"]').click();await test.locator('[data-view="train"]').click();
    assert(await test.locator('#trainingWorkspace [data-reference-kind="muscle"]').getAttribute('aria-pressed')==='true','reference tab survives navigation');
    assert(await test.evaluate(()=>JSON.stringify(state))===before,'browsing does not record training');
  });
  await scenario('keyboard-viewport-simulation',async(test,assert)=>{
    await test.locator('#setKg').focus();
    await test.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:innerHeight-320});Object.defineProperty(visualViewport,'offsetTop',{configurable:true,value:0});visualViewport.dispatchEvent(new Event('resize'));});
    assert(await test.evaluate(()=>document.body.classList.contains('keyboard-open')),'viewport keyboard state');
    assert(await test.locator('#workbenchNav').isHidden(),'nav hidden during simulated keyboard');
    const bar=await test.locator('#trainActionBar').boundingBox();assert(bar.y+bar.height<=524,'action above simulated keyboard');
    await test.locator('#setKg').fill('12');await test.locator('#setReps').fill('8');await test.locator('#setReps').press('Enter');
    assert(await test.evaluate(()=>TrainingWorkspace.exportData().sessions['2026-11-03:a_row'].sets.length)===1,'Enter confirms with simulated keyboard');
    await test.evaluate(()=>{delete visualViewport.height;delete visualViewport.offsetTop;visualViewport.dispatchEvent(new Event('resize'));});
    assert(await test.locator('#workbenchNav').isVisible(),'nav restored');
  });
  await scenario('workbench-week-record-reflection',async(test,assert)=>{
    await test.locator('#setKg').fill('20');await test.locator('#setReps').fill('12');
    for(let n=0;n<3;n++){await test.locator('[data-complete-set]').click();await test.locator('[data-end-rest]').click();}
    await test.locator('[data-view="week"]').click();
    const row=test.locator('#day-2026-11-03 .ex[data-ex="a_row"]');
    assert(await row.locator('input[type="checkbox"]').isChecked(),'week checkbox reflects completed workbench exercise');
    assert(await row.locator('input[type="text"]').inputValue()==='20kg','week weight reflects workbench actual');
    await test.locator('[data-view="train"]').click();await test.locator('[data-undo-set]').click();await test.locator('[data-view="week"]').click();
    assert(!await row.locator('input[type="checkbox"]').isChecked(),'week checkbox reflects undone final set');
  });
  await scenario('save-helper-real-dom-card',async(test,assert)=>{
    const row=test.locator('#day-2026-11-03 .ex[data-ex="a_row"]');
    assert(await row.evaluate(el=>el instanceof HTMLElement&&el.isConnected),'real connected card exists');
    await test.evaluate(()=>saveExerciseSet('2026-11-03','a_row','21kg',true));
    assert(await row.evaluate(el=>el.classList.contains('done')),'helper reflects committed completion');
    assert(await test.evaluate(()=>state.days['2026-11-03'].exercises.a_row.done&&state.days['2026-11-03'].exercises.a_row.actual==='21kg'),'helper commits actual and completion');
    await test.evaluate(()=>saveExerciseSet('2026-11-03','a_row',null,false));
    assert(await row.evaluate(el=>!el.classList.contains('done')),'helper reflects committed reversal');
  });
  await page.evaluate(results=>globalThis.fitnessExtendedReport={results,limitations:['Chromium emulation only','safe area uses CSS simulation','live SW blocked']},results);
  const failures=results.filter(r=>r.status==='FAIL');if(failures.length)throw Error(JSON.stringify(failures));
}
