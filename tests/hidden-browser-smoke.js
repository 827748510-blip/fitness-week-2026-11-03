// Real-browser regression for native hidden semantics. All external traffic blocked.
async (page) => {
  const context=await page.context().browser().newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  const test=await context.newPage(),errors=[],external=[];
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const audits=[];
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin==='http://127.0.0.1:18741' && route.request().method()==='GET')return route.continue();
    external.push(url.hostname);return route.abort();
  });
  test.on('pageerror',error=>errors.push(error.message));
  async function audit(label){
    const bad=await test.locator('[hidden]').evaluateAll(nodes=>nodes.filter(el=>getComputedStyle(el).display!=='none').map(el=>({tag:el.tagName,id:el.id,className:el.className,display:getComputedStyle(el).display})));
    check(bad.length===0,`${label}: hidden elements displayed: ${JSON.stringify(bad)}`);
    audits.push(label);
  }
  try{
    await test.goto('http://127.0.0.1:18741/');
    await test.evaluate(()=>window.TrainingWorkspace?.navigate('week'));
    await test.locator('#days [data-exercise="a_chest"]').waitFor();
    const before=await test.evaluate(()=>JSON.stringify(state));
    for(const width of [390,1440]){
      await test.setViewportSize({width,height:width===390?844:1000});
      const chest=test.locator('#days [data-exercise="a_chest"]');
      const select=chest.getByRole('combobox',{name:'胸推动作变式'});
      const source=chest.locator('.guide-source');
      await audit(`${width}: initial`);
      await select.selectOption('smith');
      check(await source.isHidden(),`${width}: Smith must hide machine source link`);
      check(await chest.locator('.guide-animation').isHidden(),`${width}: Smith animation hidden`);
      check(await chest.locator('.guide-static').isVisible(),`${width}: Smith notice visible`);
      check(await chest.getByRole('link',{name:/ACE · Seated Chest Press/}).count()===0,`${width}: Smith source absent from accessible links`);
      await audit(`${width}: Smith`);
      await chest.screenshot({path:`output/playwright/stage-smith-hidden-${width}.png`});
      await select.selectOption('machine');
      check(await source.isVisible(),`${width}: machine source restored`);
      check(await chest.locator('.guide-animation').isVisible(),`${width}: machine animation restored`);
      check(await chest.locator('.guide-static').isHidden(),`${width}: machine hides Smith notice`);
      await audit(`${width}: machine restored`);
      await chest.getByRole('button',{name:'开始休息 120 秒',exact:true}).click();
      check(await chest.getByRole('button',{name:'结束计时',exact:true}).isVisible(),`${width}: active rest cancel visible`);
      await audit(`${width}: active rest`);
      await select.selectOption('smith');
      check(await chest.locator('[data-action="cancel-rest"]').isHidden(),`${width}: variant change ends and hides rest`);
      await audit(`${width}: Smith after rest`);
      await select.selectOption('machine');
      await chest.getByRole('button',{name:'开始休息 120 秒',exact:true}).click();
      await chest.getByRole('button',{name:'结束计时',exact:true}).click();
      check(await chest.locator('[data-action="cancel-rest"]').isHidden(),`${width}: canceled rest hidden`);
      await audit(`${width}: canceled rest`);
      await chest.screenshot({path:`output/playwright/stage-machine-restored-${width}.png`});
      await test.evaluate(()=>window.TrainingWorkspace.navigate('stats'));
      check(await test.locator('#tab-week').isHidden(),`${width}: week tab hidden`);
      check(await test.locator('#tab-stats').isVisible(),`${width}: stats tab visible`);
      await audit(`${width}: stats tab`);
      await test.evaluate(()=>window.TrainingWorkspace.navigate('week'));
      check(await test.locator('#tab-stats').isHidden(),`${width}: stats tab hidden`);
      await audit(`${width}: week restored`);
    }
    check(await test.evaluate(()=>JSON.stringify(state))===before,'visibility controls never alter training state');
    check(external.length===0,'visibility tests make zero external requests');
    check(errors.length===0,'no browser runtime errors');
    await page.evaluate(report=>{globalThis.fitnessHiddenReport=report;},{result:'PASS',browser:'Chrome (actual launch)',widths:[390,1440],audits,checks:['Smith source hidden and absent from accessible links','machine source restored','animation and notice visibility','active/canceled/variant-ended rest buttons','week/stats panels','every [hidden] computed display:none','unchanged training state','zero external requests','no runtime errors']});
  }finally{await context.close();}
}
