// Fault injection against actual DOM and storage; all user records are synthetic.
async(page)=>{
  const browser=page.context().browser(),results=[];
  const primary='fitness-review-v2',secondary='fitness-review-session-v1';
  const installFault=()=>{
    const native=Storage.prototype.setItem;
    const fault=window.__replacementFault={mode:window.name==='p2-block-on-reload'?'all':'off',count:0,sideWrites:0};
    Storage.prototype.setItem=function(key,value){
      if(key==='fitness-review-v2'||key==='fitness-review-session-v1'){
        fault.count++;if(key==='fitness-review-session-v1')fault.sideWrites++;
        if(fault.mode==='all'||(fault.mode==='stage'&&key==='fitness-review-session-v1')||(fault.mode==='primary'&&key==='fitness-review-v2')||(fault.mode==='compound'&&fault.count>1)||(fault.mode==='cleanup'&&key==='fitness-review-session-v1'&&fault.sideWrites>1)||(fault.mode==='sidecar'&&key==='fitness-review-session-v1'))throw new DOMException('synthetic replacement storage failure','QuotaExceededError');
      }
      return native.call(this,key,value);
    };
  };
  async function scenario(name,run,production=false,config=null){
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[],external=[];
    if(!production)await context.addInitScript(installFault);
    const origin=production?'http://127.0.0.1:18741':'http://127.0.0.1:18742';
    await context.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url());
      if(production&&config&&url.pathname==='/sync-config.js')return route.fulfill({status:200,contentType:'text/javascript',body:'window.FITNESS_SYNC_CONFIG='+JSON.stringify(config)+';'});
      if(url.origin===origin&&request.method()==='GET')return route.continue();
      external.push({origin:url.origin,method:request.method()});return route.abort();
    });
    const test=await context.newPage();test.on('pageerror',e=>errors.push(e.message));
    const check=(condition,message)=>{if(!condition)throw Error(message);};
    try{await test.goto(origin);await test.locator('#trainingWorkspace').waitFor();await run(test,check);check(errors.length===0,errors.join(';'));check(external.length===0,'unexpected network: '+JSON.stringify(external));results.push({name,status:'PASS',runtimeErrors:0,realExternalRequests:0});}
    catch(error){results.push({name,status:'FAIL',error:error.message,errors,external});}
    finally{await context.close();}
  }
  const count=test=>test.evaluate(()=>TrainingWorkspace.exportData().sessions['2026-11-03:a_row']?.sets.length||0);
  const invoke=(test,action,backup)=>test.evaluate(({action,backup})=>{
    window.confirm=()=>true;window.prompt=()=>JSON.stringify(backup);window.alert=text=>window.__lastAlert=text;
    if(action==='reset')resetData();else importJson();
    return {hint:document.getElementById('saveHint').textContent,alert:window.__lastAlert||'',uploads:window.__uploads.length};
  },{action,backup});
  for(const action of ['reset','import'])for(const mode of ['stage','primary','compound','cleanup','notification']){
    await scenario(action+'-'+mode,async(test,check)=>{
      await test.evaluate(()=>{state.weeks['2026-10-27']={days:{'2026-10-27':{weight:'88.8',done:true}}};state.weightLog.push({date:'2026-10-27',kg:88.8});setWeight('2026-11-03','77.7');});
      await test.locator('#setKg').fill('20');await test.locator('#setReps').fill('10');await test.locator('[data-complete-set]').click();await test.locator('[data-end-rest]').click();
      await test.evaluate(async()=>{await syncNow();window.__uploads=[];const native=window.fetch;window.fetch=(input,options)=>{if(options?.method==='PUT')window.__uploads.push(options.body);return native(input,options);};});
      const original=await test.evaluate(()=>({primary:localStorage.getItem('fitness-review-v2'),sidecar:localStorage.getItem('fitness-review-session-v1')}));
      const backup=await test.evaluate(()=>{const incoming=JSON.parse(JSON.stringify(state));incoming.days['2026-11-03'].weight='66.6';return {state:incoming,workbench:{version:1,sessions:{'2026-11-03:a_row':{sets:[{kg:30,reps:8},{kg:30,reps:9}],kg:'30',reps:'9'}}}};});
      await test.evaluate(mode=>{Object.assign(window.__replacementFault,{mode:mode==='notification'?'off':mode,count:0,sideWrites:0});if(mode==='notification')window.TrainingWorkspace.onRecordsChanged=()=>{throw Error('synthetic post-commit UI notification failure');};window.name='p2-block-on-reload';},mode);
      const result=await invoke(test,action,backup),committed=mode==='cleanup'||mode==='notification',expected=committed?(action==='reset'?0:2):1;
      check(await count(test)===expected,'in-memory groups follow commit decision');
      const disk=await test.evaluate(()=>({primary:localStorage.getItem('fitness-review-v2'),sidecar:localStorage.getItem('fitness-review-session-v1')}));
      if(!committed){
        check(disk.primary===original.primary,'failed replacement preserves primary bytes');
        if(mode!=='compound')check(disk.sidecar===original.sidecar,'failed replacement restores exact sidecar');
        else check(JSON.parse(disk.sidecar).sessions['2026-11-03:a_row'].sets.length===1,'failed rollback leaves canonical old groups');
        check(action==='reset'?result.hint.includes('清空失败'):result.alert.includes('导入失败'),'failure is explicit');check(result.uploads===0,'failed operation queues no new upload');
      }else{
        check(disk.primary!==original.primary,'primary committed');if(mode==='cleanup'){check(JSON.parse(disk.sidecar).pending.version===2,'durable replacement journal retained');check((action==='reset'?result.hint:result.alert).includes('恢复日志待整理'),'cleanup failure disclosed');}
        else check((action==='reset'?result.hint:result.alert).includes('更新失败'),'post-commit notification failure cannot reverse committed records');
      }
      await test.reload();check(await count(test)===expected,'blocked reload uses correct canonical/candidate groups');
      check(await test.evaluate(()=>state.weeks['2026-10-27'].days['2026-10-27'].weight==='88.8'&&state.weightLog.some(e=>e.date==='2026-10-27'&&e.kg===88.8)),'other week history preserved');
      if(committed){
        await test.evaluate(()=>{window.__replacementFault.mode='sidecar';setWeight('2026-11-03','55.5');});
        await test.reload();check(await count(test)===expected,'later primary edit does not erase committed journal decision');
        check(await test.evaluate(()=>state.days['2026-11-03'].weight==='55.5'),'later primary edit retained');
      }
      await test.evaluate(()=>{window.__replacementFault.mode='off';window.name='';window.__uploads=[];});
      await invoke(test,action,backup);
      const target=action==='reset'?0:2;
      check(await count(test)===target,'writable retry/replacement applied once');
      check(await test.evaluate(()=>!JSON.parse(localStorage.getItem('fitness-review-session-v1')).pending),'recovery journal compacted');
      await test.reload();check(await count(test)===target,'successful replacement survives normal reload');
    });
  }
  await scenario('malformed-recovery-journal',async(test,check)=>{
    await test.evaluate(()=>{const raw=JSON.parse(localStorage.getItem('fitness-review-session-v1'));raw.sessions={};raw.pending={version:2,sessions:{'2026-11-03:a_row':{sets:[{kg:30,reps:8}]}}};localStorage.setItem('fitness-review-session-v1',JSON.stringify(raw));window.name='p2-block-on-reload';});
    await test.reload();check(await count(test)===0,'missing transaction identity never commits a candidate');
  });
  for(const [name,config] of [['shipped-config',null],['placeholder-config',{enabled:true,endpoint:'https://sync.invalid/synthetic'}],['secret-config',{enabled:true,endpoint:'/api/fitness-sync',editToken:'synthetic-only'}]]){
    await scenario(name,async(test,check)=>{
      check(await test.evaluate(()=>!SYNC.enabled),'sync disabled before edits');
      await test.locator('#setKg').fill('20');await test.locator('#setReps').fill('10');await test.locator('[data-complete-set]').click();await test.evaluate(()=>syncNow());
      check(await test.evaluate(()=>syncTimer===null&&!syncInFlight&&!syncQueued),'disabled sync never queues uploads');
      check((await test.locator('.work-sync-note').textContent()).includes('仅保存在本机'),'workspace discloses local-only records');
      await test.reload();check(await test.evaluate(()=>!SYNC.enabled&&syncTimer===null),'reopen does not upload');
      check(await test.evaluate(()=>TrainingWorkspace.exportData().sessions['2026-11-03:a_row'].sets.length===1),'local records retained');
    },true,config);
  }
  await page.evaluate(results=>globalThis.fitnessP2Report={results,scope:'synthetic cloud browser tests; no production writes'},results);
  const failed=results.filter(r=>r.status==='FAIL');if(failed.length)throw Error(JSON.stringify(failed));
}
