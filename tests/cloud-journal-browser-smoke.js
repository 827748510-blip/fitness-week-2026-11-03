// Actual browser execution of complete/undo under multi-write storage failures.
async(page)=>{
 const browser=page.context().browser(),results=[];
 const installFault=()=>{
  if(window.__storageFault)return;
  const native=Storage.prototype.setItem;
  const fault=window.__storageFault={mode:window.name==='cloud-journal-blocked'?'all':'off',count:0,calls:[]};
  Storage.prototype.setItem=function(key,value){
   const tracked=key==='fitness-review-v2'||key==='fitness-review-session-v1';
   if(tracked){fault.count++;fault.calls.push(key);const blocked=fault.mode==='all'||(fault.mode==='after-first'&&fault.count>1)||(fault.mode==='after-second'&&fault.count>2)||(fault.mode==='primary-only'&&key!=='fitness-review-v2');if(blocked)throw new DOMException('synthetic compound storage failure','QuotaExceededError');}
   return native.call(this,key,value);
  };
  window.__unblockStorage=()=>{fault.mode='off';window.name='';};
 };
 const arm=async(test,mode)=>test.evaluate(mode=>{Object.assign(window.__storageFault,{mode,count:0,calls:[]});window.name='cloud-journal-blocked';},mode);
 const sets=test=>test.evaluate(()=>TrainingWorkspace.exportData().sessions['2026-11-03:a_row'].sets.length);
 const raw=test=>test.evaluate(()=>JSON.parse(localStorage.getItem('fitness-review-session-v1')));
 const primary=test=>test.evaluate(()=>JSON.stringify(state));
 async function scenario(name,run){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:18742'&&route.request().method()==='GET'?route.continue():route.abort());
  const test=await context.newPage(),errors=[];test.on('pageerror',e=>errors.push(e.message));
  const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
  try{await test.goto('http://127.0.0.1:18742/');await context.addInitScript(installFault);await test.evaluate(installFault);await test.locator('#setKg').fill('19,5');await test.locator('#setReps').fill('9');await run(test,assert);assert(errors.length===0,errors.join('; '));results.push({name,status:'PASS'});}
  catch(e){results.push({name,status:'FAIL',error:e.message,errors});}
  finally{await context.close();}
 }
 const finish=async(test,n)=>{for(let i=0;i<n;i++){await test.locator('[data-complete-set]').click();await test.locator('[data-end-rest]').click();}};
 await scenario('complete-primary-and-rollback-fail',async(test,assert)=>{
  const before=await primary(test);await arm(test,'after-first');await test.locator('[data-complete-set]').click();
  let disk=await raw(test);assert(disk.sessions['2026-11-03:a_row'].sets.length===0&&disk.pending.sessions['2026-11-03:a_row'].sets.length===1,'canonical disk keeps original and journals candidate');assert(await primary(test)===before&&await sets(test)===0,'failed primary keeps original memory');
  await test.locator('[data-complete-set]').click();assert(await sets(test)===0,'repeated failed attempt does not add set');
  await test.reload();assert(await sets(test)===0&&await primary(test)===before,'blocked reload rejects pending candidate');assert(await test.locator('#setKg').inputValue()==='19,5'&&await test.locator('#setReps').inputValue()==='9','draft inputs survive');
  await test.evaluate(()=>__unblockStorage());await test.locator('[data-complete-set]').click();assert(await sets(test)===1,'one retry commits once');disk=await raw(test);assert(!disk.pending,'journal compacted after writable retry');
 });
 await scenario('undo-primary-and-rollback-fail',async(test,assert)=>{
  await finish(test,3);const before=await primary(test);await arm(test,'after-first');await test.locator('[data-undo-set]').click();
  let disk=await raw(test);assert(disk.sessions['2026-11-03:a_row'].sets.length===3&&disk.pending.sessions['2026-11-03:a_row'].sets.length===2,'undo journal retains original canonical sets');assert(await sets(test)===3&&await primary(test)===before,'failed undo keeps original memory');
  await test.locator('[data-undo-set]').click();assert(await sets(test)===3,'repeated failed undo preserves all sets');await test.reload();assert(await sets(test)===3&&await primary(test)===before,'blocked reload retains original confirmed sets');
  await test.evaluate(()=>__unblockStorage());await test.locator('[data-undo-set]').click();assert(await sets(test)===2&&await test.evaluate(()=>!state.days['2026-11-03'].exercises.a_row.done),'undo retry changes one set');assert(!(await raw(test)).pending,'undo journal compacted');
 });
 await scenario('complete-committed-cleanup-fails',async(test,assert)=>{
  await arm(test,'after-second');await test.locator('[data-complete-set]').click();assert(await sets(test)===1,'primary committed once');assert((await raw(test)).pending,'pending commit survives cleanup failure');assert((await test.locator('#setError').textContent()).includes('操作已保存'),'message distinguishes committed operation');
  await test.locator('[data-view="week"]').click();await test.locator('[data-view="train"]').click();assert((await test.locator('#setError').textContent()).includes('操作已保存'),'failed cleanup warning remains accurate after navigation');
  await test.reload();assert(await sets(test)===1,'blocked reload recovers committed group');await test.locator('[data-complete-set]').click();assert(await sets(test)===1,'blocked repeat cannot add another');await test.evaluate(()=>__unblockStorage());await test.locator('[data-view="week"]').click();await test.locator('[data-view="train"]').click();assert(await sets(test)===1&&!(await raw(test)).pending,'writable render compacts without duplicating');
 });
 await scenario('undo-committed-cleanup-fails',async(test,assert)=>{
  await finish(test,3);await arm(test,'after-second');await test.locator('[data-undo-set]').click();assert(await sets(test)===2&&await test.evaluate(()=>!state.days['2026-11-03'].exercises.a_row.done),'undo committed before cleanup');assert((await raw(test)).pending,'undo recovery journal retained');
  await test.reload();assert(await sets(test)===2,'blocked reload recovers committed undo');await test.locator('[data-undo-set]').click();assert(await sets(test)===2,'blocked duplicate undo does not remove a second set');await test.evaluate(()=>__unblockStorage());await test.locator('[data-view="week"]').click();await test.locator('[data-view="train"]').click();assert(await sets(test)===2&&!(await raw(test)).pending,'writable cleanup preserves recovered undo');
 });
 await scenario('identical-primary-snapshot-journal',async(test,assert)=>{
  await finish(test,1);const before=await primary(test);await arm(test,'after-first');await test.locator('[data-complete-set]').click();assert(await sets(test)===2&&await primary(test)===before,'identical primary needs no failing redundant write');assert((await raw(test)).pending.expectedPrimary===null,'sidecar-only decision explicitly committed');await test.reload();assert(await sets(test)===2,'sidecar-only commit recovers');
 });
 await scenario('committed-journal-survives-unrelated-edit',async(test,assert)=>{
  await arm(test,'after-second');await test.locator('[data-complete-set]').click();await test.evaluate(()=>{__storageFault.mode='primary-only';setWeight('2026-11-03','77.7');});await test.reload();assert(await sets(test)===1&&await test.evaluate(()=>state.days['2026-11-03'].weight==='77.7'),'unrelated bodyweight edit does not invalidate committed set');
 });
 await scenario('rejected-journal-survives-unrelated-edit',async(test,assert)=>{
  await arm(test,'after-first');await test.locator('[data-complete-set]').click();await test.evaluate(()=>{__storageFault.mode='primary-only';setWeight('2026-11-03','77.7');});await test.reload();assert(await sets(test)===0&&await test.evaluate(()=>state.days['2026-11-03'].weight==='77.7'),'unrelated edit does not commit rejected group');
 });
 await page.evaluate(results=>globalThis.fitnessJournalReport={results,syntheticOnly:true,liveWorkers:'blocked',coverage:'stage success then primary+cleanup fail; successful primary then cleanup fails; reload still write-blocked; writable retry; repeated operations; unchanged primary; unrelated edits'},results);
 const failures=results.filter(r=>r.status==='FAIL');if(failures.length)throw Error(JSON.stringify(failures));
}
