/* Phone-first training workspace. v2 training records retain their original schema. */
(() => {
  'use strict';
  const isolated=STORAGE_KEY==='fitness-review-v2';
  const KEY=isolated?'fitness-review-session-v1':'fitness-session-v1';
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons={train:'<path d="M6 6v12M3 9v6m15-9v12m3-9v6M6 12h12"/>',plan:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-11 4h2m3 0h2"/>',chart:'<path d="M4 4v16h16M8 15l4-5 4 3 4-7"/>',check:'<path d="m5 12 4 4L19 6"/>',back:'<path d="m14 6-6 6 6 6"/>',next:'<path d="m10 6 6 6-6 6"/>'};
  const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.train}</svg>`;
  let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}');}catch(_){}
  let recovery='';
  // Canonical sessions stay unchanged until the primary write succeeds. A
  // journal allows reload recovery even when cleanup/rollback also cannot write.
  if(saved.pending?.version===1){
    let committed=false;
    try{committed=saved.pending.expectedPrimary===null||primaryMatches(localStorage.getItem(STORAGE_KEY),saved.pending.expectedPrimary,saved.pending.record);}catch(_){}
    if(committed)saved.sessions=saved.pending.sessions;
    recovery=committed?'已从本机恢复日志找回组次记录。':'上次操作未写入训练记录，已保留操作前的组次和输入。';
  }
  let selectedDate=days.some(d=>d.date===saved.date)?saved.date:days[0].date;
  let selectedId=saved.exercise||'a_row',view='train',restEnd=0,timer=0,rendering=false;
  let sessions=normalizeSessions(saved.sessions);
  function normalizeSessions(input){
    const output={};if(!input||typeof input!=='object')return output;
    days.forEach(day=>(day.exercises||[]).forEach(ex=>{const k=`${day.date}:${ex.id}`,raw=input[k];if(!raw||typeof raw!=='object')return;const groups=Number(ex.sets.match(/^(\d+)×/)?.[1]||1);
      const sets=(Array.isArray(raw.sets)?raw.sets:[]).slice(0,groups).filter(s=>s&&Number.isInteger(s.reps)&&s.reps>0&&s.reps<=10000&&((Number.isFinite(s.kg)&&s.kg>=0&&s.kg<=2000)||(typeof s.actual==='string'&&s.actual.length<=120))).map(s=>({...((typeof s.actual==='string')?{actual:s.actual}:{kg:s.kg}),reps:s.reps,at:typeof s.at==='string'?s.at:''}));
      output[k]={sets,kg:typeof raw.kg==='string'?raw.kg.slice(0,120):'',reps:typeof raw.reps==='string'?raw.reps.slice(0,10):'',confirmed:raw.confirmed===true,variant:raw.variant==='smith'?'smith':'machine'};
    }));return output;
  }
  let error=recovery;
  const top=document.createElement('header');top.id='workbenchTopbar';
  top.innerHTML=`<div class="workbench-brand">${icon('train')}<span>练习日常<small>YOUR TRAINING SPACE</small></span></div><div id="motionControlSlot"></div>`;
  const pane=document.createElement('section');pane.id='trainingWorkspace';pane.setAttribute('aria-label','训练工作台');
  const nav=document.createElement('nav');nav.id='workbenchNav';nav.setAttribute('aria-label','主要导航');
  nav.innerHTML=[['train','训练','train'],['week','周计划','plan'],['stats','进度','chart']].map(([id,label,i])=>`<button type="button" data-view="${id}" ${id==='train'?'aria-current="page"':''}>${icon(i)}<span>${label}</span></button>`).join('');
  const action=document.createElement('section');action.id='trainActionBar';action.setAttribute('aria-label','当前训练主操作');
  document.querySelector('.wrap').prepend(top,pane);document.body.append(action,nav);
  const motion=document.getElementById('motionSetting');if(motion)motion.hidden=true;document.getElementById('motionControlSlot').innerHTML='<button type="button" data-open-library>动作图集 · 32</button>';
  document.body.classList.add('workbench-enabled');
  function current(){const day=days.find(d=>d.date===selectedDate)||days[0],list=day.exercises||[];return {day,list,ex:list.find(e=>e.id===selectedId)||list[0]||null};}
  function key(ex){return `${selectedDate}:${ex.id}`;}
  function log(ex){const k=key(ex);if(!sessions[k]||!Array.isArray(sessions[k].sets))sessions[k]={sets:[],kg:'',reps:''};return sessions[k];}
  function plan(ex){const match=ex.sets.match(/^(\d+)×([\d–-]+)(.*)$/);return {groups:match?Number(match[1]):1,target:match?match[2]:(/分钟/.test(ex.sets)?'如 1200':ex.sets),timed:/秒|分钟/.test(ex.sets),compound:/超级组|\+/.test(ex.name),perSide:/单臂|\/侧/.test(ex.name+ex.sets)||ex.id==='c_lateral',weighted:ex.suggest!=='-'&&ex.suggest!=='自重',counted:!!match};}
  function sidecar(recorded=sessions){return {version:1,date:selectedDate,exercise:selectedId,sessions:recorded,restEnd};}
  function primaryMatches(raw,expected,record){
    if(typeof expected!=='string'||typeof raw!=='string')return false;
    if(raw===expected)return true;
    // Unrelated edits (for example bodyweight) must not invalidate a committed
    // group whose journal could not yet be compacted.
    if(!record||typeof record.date!=='string'||typeof record.id!=='string')return false;
    try{
      const projection=value=>{const data=JSON.parse(value),exercise=data.days?.[record.date]?.exercises?.[record.id];if(!exercise)throw new Error('Missing exercise');return JSON.stringify([exercise,(data.liftLog||[]).filter(item=>item.date===record.date&&item.exerciseId===record.id)]);};
      return projection(raw)===projection(expected);
    }catch(_){return false;}
  }
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(sidecar()));return true;}catch(_){if(!error)error='本机空间不足，组次未保存。请先导出或释放空间。';return false;}}
  function commitSessions(previous,nextPrimary,failureMessage){
    let expectedPrimary=null;
    const record={date:selectedDate,id:current().ex.id};
    try{
      // An unchanged primary snapshot needs no second write or ambiguous commit.
      const serialized=nextPrimary?JSON.stringify(nextPrimary):null;
      if(nextPrimary&&!primaryMatches(localStorage.getItem(STORAGE_KEY),serialized,record))expectedPrimary=serialized;
      localStorage.setItem(KEY,JSON.stringify({...sidecar(previous),pending:{version:1,expectedPrimary,record,sessions}}));
    }catch(_){sessions=previous;error='本机空间不足，操作未保存；原组次和输入保留，请重试。';render();return false;}
    try{if(expectedPrimary!==null)save(nextPrimary);}
    catch(_){
      sessions=previous;
      const cleaned=persist();
      error=failureMessage+(cleaned?'':' 本机仍保留恢复日志，刷新将使用原记录。');
      render();return false;
    }
    const cleaned=persist();
    error=cleaned?'':'操作已保存，组次恢复日志待整理；可安全重开，恢复可写后会自动整理。';
    return true;
  }
  function paintAction(){
    if(view!=='train'){action.hidden=true;return;}action.hidden=false;
    const {ex}=current();if(!ex){action.innerHTML='<p>恢复日也算训练的一部分。完成后在周计划手动确认。</p><button type="button" data-go-week>查看恢复计划</button>';return;}
    const p=plan(ex),entry=log(ex),n=entry.sets.length,remaining=Math.max(0,Math.ceil((restEnd-Date.now())/1000));
    action.classList.toggle('resting',remaining>0);
    if(remaining){const clock=action.querySelector('[data-rest-timer]');if(action.classList.contains('resting')&&clock){clock.textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;return;}action.innerHTML=`<div class="rest-action-copy"><span>组间休息</span><strong data-rest-timer>${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}</strong><small>按状态准备下一组</small></div><button type="button" data-end-rest>结束休息 ${icon('next')}</button>`;}
    else if(n>=p.groups||state.days[selectedDate].exercises[ex.id]?.done){action.innerHTML=`<div class="action-context">${icon('check')}<span>${n>=p.groups?`${p.groups} 组已手动完成`:'已有动作完成记录'}</span></div><button class="work-primary" type="button" ${current().list.at(-1)?.id===ex.id?'data-go-week':'data-next-ex'}>${current().list.at(-1)?.id===ex.id?'查看当日计划':'下一动作'} ${icon('next')}</button>`;}
    else action.innerHTML=`<div class="action-context"><span>本动作</span><strong>第 ${n+1} / ${p.groups} 组</strong></div><button class="work-primary" type="button" data-complete-set>${icon('check')}<span>${n+1===p.groups?'完成本组，确认动作':'完成一组，开始休息'}</span></button>`;
  }
  function startRest(seconds){clearInterval(timer);restEnd=Date.now()+seconds*1000;persist();paintAction();timer=setInterval(()=>{if(Date.now()>=restEnd){restEnd=0;persist();clearInterval(timer);document.getElementById('workStatus').textContent='休息结束，准备好后再开始。';}paintAction();},500);}
  function stopRest(){restEnd=0;clearInterval(timer);persist();paintAction();}
  function render(preserve=false){
    if(rendering)return;rendering=true;
    const {day,list,ex}=current();if(ex)selectedId=ex.id;
    const index=list.indexOf(ex),p=ex?plan(ex):null,entry=ex?log(ex):null;
    const weekdays='日一二三四五六';
    pane.innerHTML=`<div class="workspace-intro"><div><p class="workspace-eyebrow">专注这一组 · 按自己的节奏</p><h1>TRAINING<span>训练工作台</span></h1></div><label class="date-control"><span>当前计划</span><select id="workDate" aria-label="训练日期">${days.map(d=>`<option value="${d.date}" ${d.date===selectedDate?'selected':''}>${d.date.slice(5).replace('-','/')} 周${d.dow} · ${d.type==='R'?'恢复':`力量 ${d.type}`}</option>`).join('')}</select></label></div>
      <div class="work-week-strip" aria-label="本周日期">${days.map(d=>`<button type="button" data-pick-date="${d.date}" class="${d.date===selectedDate?'selected':''}"><span>周${d.dow}</span><strong>${d.date.slice(8)}</strong><i class="${state.days[d.date].done?'done':''}"></i></button>`).join('')}</div><div class="session-strip"><span>${day.type==='R'?'恢复与活动':`力量 ${day.type} · ${list.length} 个动作`}</span><span>${selectedDate} 计划</span></div>
      ${ex?`<div class="workspace-grid"><div class="work-main"><div class="current-heading"><div><p>当前动作 <span>${String(index+1).padStart(2,'0')} / ${String(list.length).padStart(2,'0')}</span></p><h2>${safe(ex.name)}</h2></div><div class="exercise-switch"><button type="button" data-prev-ex aria-label="上一个动作">${icon('back')}</button><button type="button" data-next-ex aria-label="下一个动作">${icon('next')}</button></div></div>
      <div class="workbench-visual">${window.TrainingReferences.card(ex)}<p class="work-reference-cues">注意：${safe(ex.cues)}</p></div>
      </div><aside class="work-entry"><div class="set-heading"><h3>记录这一组</h3><span>${state.days[selectedDate].exercises[ex.id]?.done&&!entry.sets.length?'已有完成记录':`${entry.sets.length} / ${p.groups} 组完成`}</span></div><div class="set-chips" aria-label="本机组次进度">${Array.from({length:p.groups},(_,i)=>`<span class="set-chip ${i<entry.sets.length?'complete':i===entry.sets.length?'current':''}">${i<entry.sets.length?icon('check'):`${String(i+1).padStart(2,'0')}`}<small>${i<entry.sets.length?`${safe(entry.sets[i].reps)} ${p.timed?'秒':'次'}`:'待完成'}</small></span>`).join('')}</div>
      <p class="set-prescription">原计划 <strong>${safe(ex.sets)}</strong><span>${safe(ex.rest||'按自身节奏休息')}</span></p>${p.perSide?'<p class="bilateral-note">单臂示意：两侧均完成后，再确认这一组。</p>':''}
      <form id="setEntryForm" novalidate><div class="work-inputs"><label><span>${p.compound?'重量备注':p.weighted?'实际重量':'重量方式'} <small>${p.compound?'各动作':p.weighted?'kg':''}</small></span>${p.weighted?`<input id="setKg" name="kg" type="text" inputmode="${p.compound?'text':'decimal'}" enterkeyhint="next" autocomplete="off" value="${safe(entry.kg)}" placeholder="例如 50" aria-describedby="setError"/>`:`<span class="work-bodyweight">${ex.suggest==='自重'?'自重':'无外加重量'}</span>`}</label><label><span>${p.timed?'实际时长':p.compound?'各动作次数':p.perSide?'每侧次数':'实际次数'} <small>${p.timed?'秒':'次'}</small></span><input id="setReps" name="reps" type="text" inputmode="numeric" enterkeyhint="done" autocomplete="off" value="${safe(entry.reps)}" placeholder="${safe(p.target)}" aria-describedby="setError"/></label></div><p id="setError" role="alert">${safe(error)}</p><button class="work-inline-submit" type="submit">确认这一组 ${icon('check')}</button></form>
      <div class="work-set-history"><div><span>组</span><span>${p.timed?'秒数':'次数'}</span><span>实际重量</span></div>${entry.sets.map((set,i)=>`<div><span>${i+1} ${icon('check')}</span><strong>${set.reps}</strong><strong>${safe(set.actual??set.kg+' kg')}</strong></div>`).join('')||'<p>完成后显示本机组记录</p>'}</div><p class="weight-suggestion">原建议：${safe(ex.suggest)}${state.days[selectedDate].exercises[ex.id]?.actual?`<br/>原记录：${safe(state.days[selectedDate].exercises[ex.id].actual)}`:''}<br/><span>按实际完成填写，不自动加重。</span></p>
      <div class="work-quick-tools"><button type="button" data-manual-rest>只休息 ${icon('next')}</button><button type="button" data-undo-set ${entry.sets.length?'':'disabled'}>撤销刚才一组</button></div>
      <p class="work-status" id="workStatus" role="status">${entry.sets.length>=p.groups?'本动作已由你手动确认。':'完成一组后开始休息；最后一组会同时确认本动作。'}</p>
      </aside></div>`:`<section class="recovery-panel"><div class="recovery-orbit">${icon('plan')}</div><h2>今天，让身体恢复。</h2><p>${safe(day.cardio||day.summary)}</p><button type="button" data-go-week>查看当日完整计划 ${icon('next')}</button></section>`}
      <section class="work-plan-list"><div class="work-list-heading"><h2>本次动作</h2><span>点选切换，不会标记完成</span></div>${list.map((e,i)=>{const count=(sessions[`${selectedDate}:${e.id}`]?.sets||[]).length,done=state.days[selectedDate].exercises[e.id]?.done;return `<button type="button" data-pick-ex="${e.id}" class="work-ex-row ${e.id===selectedId?'selected':''}"><span class="ex-row-index">${done?icon('check'):String(i+1).padStart(2,'0')}</span><span class="ex-row-name">${safe(e.name)}<small>${safe(e.sets)} · ${safe(e.rest)}</small></span><span class="ex-row-state">${done?'已确认':count?`${count} 组`:'姿势 / 肌群'}${icon('next')}</span></button>`;}).join('')}
      <button type="button" class="reference-library-link" data-open-library><span>完整动作图集 ↗</span><small>32 个动作 · 姿势 / 肌群</small></button></section>
      <details class="session-data-note"><summary>组次明细与原记录</summary><p>图集版 2026.10.30 · 静态姿势参考；6 项器械细节待确认，详见各图标记。</p><p>组次明细保存在本机，并随本应用导出的备份保留。实际重量及动作完成状态沿用原有同步；组次明细暂不跨设备同步。切换动作不会自动完成训练。</p><p>训练前请完成原计划热身。所有动作仅为示意，不代替现场指导；出现疼痛请停止。</p></details>`;
    const currentGuide=pane.querySelector('.guide');
    if(currentGuide){
      const controls=currentGuide.querySelector('.guide-controls'),transport=currentGuide.querySelector('.guide-transport'),play=currentGuide.querySelector('[data-action="play"]');
      currentGuide.querySelector('.guide-stage').append(play);play.classList.add('canvas-pause');
      const more=document.createElement('details');more.className='motion-more';more.innerHTML='<summary>慢放、分步与动作资料 <span>+</span></summary>';
      more.append(transport,currentGuide.querySelector('.guide-scrub'),currentGuide.querySelector('.guide-scrub-label'),currentGuide.querySelector('.guide-source'),currentGuide.querySelector('.static-guide'));
      controls.append(more);
    }
    const variant=pane.querySelector('[data-action="variant"]');if(variant&&entry?.variant==='smith'){variant.value='smith';const guide=variant.closest('.guide');guide.querySelector('.guide-animation').hidden=true;guide.querySelector('.guide-static').hidden=false;guide.querySelector('.guide-source').hidden=true;}
    if(window.TrainingStage)window.TrainingStage.mount();
    window.TrainingReferences.mount(pane);
    persist();paintAction();rendering=false;
  }
  function navigate(next){view=next;document.getElementById('tab-week').hidden=next!=='week';document.getElementById('tab-stats').hidden=next!=='stats';pane.hidden=next!=='train';if(next==='week')window.render();if(next==='stats')renderStats();if(next==='train')render();nav.querySelectorAll('button').forEach(b=>{if(b.dataset.view===next)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});paintAction();window.TrainingStage.refresh();window.scrollTo({top:0});}
  function pick(id,date=selectedDate){stopRest();selectedDate=date;selectedId=id;error='';render();window.scrollTo({top:0,behavior:document.documentElement.classList.contains('reduce-motion')?'auto':'smooth'});}
  function step(delta){const {list,ex}=current();if(!list.length)return;const next=Math.max(0,Math.min(list.length-1,list.indexOf(ex)+delta));pick(list[next].id);}
  function complete(){
    const {ex}=current();if(!ex)return;const p=plan(ex),entry=log(ex);if(entry.sets.length>=p.groups||restEnd>Date.now()||state.days[selectedDate].exercises[ex.id]?.done)return;
    const rawKg=entry.kg.trim(),kg=p.compound?rawKg:rawKg.replace(',','.'),reps=entry.reps.trim();
    if(p.weighted&&(p.compound?(!kg||kg.length>120):(!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(kg)||Number(kg)>2000))){error=p.compound?'请填写各动作的实际重量备注。':'请填写实际重量，使用 kg 数字。';document.getElementById('setError').textContent=error;document.getElementById('setKg').focus({preventScroll:true});document.getElementById('setKg').scrollIntoView({block:'center',behavior:'smooth'});return;}
    if(!/^\d+$/.test(reps)||Number(reps)<1||Number(reps)>10000){error=`请填写实际${p.timed?'秒数':'次数'}，使用正整数。`;document.getElementById('setError').textContent=error;document.getElementById('setReps').focus({preventScroll:true});document.getElementById('setReps').scrollIntoView({block:'center',behavior:'smooth'});return;}
    const item={...(!p.weighted?{actual:ex.suggest==='自重'?'自重':'无外加重量'}:p.compound?{actual:kg}:{kg:Number(kg)}),reps:Number(reps),at:new Date().toISOString()};
    const previous=JSON.parse(JSON.stringify(sessions));entry.sets.push(item);entry.kg=kg;error='';
    const completed=entry.sets.length===p.groups;if(completed)entry.confirmed=true;
    const nextPrimary=p.weighted||completed?prepareExerciseSet(selectedDate,ex.id,p.weighted?(p.compound?kg:kg+'kg'):null,completed):null;
    if(!commitSessions(previous,nextPrimary,'训练记录保存失败，请重试；本组未确认。'))return;
    document.activeElement?.blur();render();const seconds=/2分钟/.test(ex.rest)?120:parseInt(ex.rest.match(/\d+/)?.[0]||'60',10);if(ex.rest&&ex.rest!=='-')startRest(seconds);else stopRest();
  }
  function undo(){
    const {ex}=current(),entry=log(ex);if(!entry.sets.length)return;
    const previous=JSON.parse(JSON.stringify(sessions)),confirmed=entry.confirmed;entry.sets.pop();entry.confirmed=false;
    if(!commitSessions(previous,confirmed?prepareExerciseSet(selectedDate,ex.id,null,false):null,'撤销失败：训练记录无法保存，请重试；原记录保留。'))return;
    stopRest();render();
  }
  pane.addEventListener('input',event=>{const {ex}=current();if(!ex)return;const entry=log(ex);if(event.target.id==='setKg')entry.kg=event.target.value;if(event.target.id==='setReps')entry.reps=event.target.value;persist();});
  pane.addEventListener('change',event=>{if(event.target.id==='workDate'){const day=days.find(d=>d.date===event.target.value);pick(day.exercises?.find(e=>window.TrainingStage.guides[e.id])?.id||day.exercises?.[0]?.id||'',day.date);}});
  pane.addEventListener('submit',event=>{if(event.target.id==='setEntryForm'){event.preventDefault();complete();}});
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.view){navigate(b.dataset.view);return;}
    if(b.dataset.pickDate){const day=days.find(d=>d.date===b.dataset.pickDate);pick(day.exercises?.find(e=>window.TrainingStage.guides[e.id])?.id||day.exercises?.[0]?.id||'',day.date);return;}
    if(b.hasAttribute('data-complete-set'))complete();
    else if(b.hasAttribute('data-end-rest')){stopRest();document.getElementById('workStatus').textContent='准备好后，继续下一组。';}
    else if(b.hasAttribute('data-next-ex'))step(1);else if(b.hasAttribute('data-prev-ex'))step(-1);
    else if(b.dataset.pickEx)pick(b.dataset.pickEx);
    else if(b.dataset.demo){const day=days.find(d=>d.exercises?.some(e=>e.id===b.dataset.demo));navigate('train');pick(b.dataset.demo,day.date);}
    else if(b.hasAttribute('data-go-week')){navigate('week');document.getElementById('day-'+selectedDate)?.scrollIntoView();}
    else if(b.hasAttribute('data-manual-rest')){const {ex}=current();startRest(/2分钟/.test(ex.rest)?120:parseInt(ex.rest.match(/\d+/)?.[0]||'60',10));}
    else if(b.hasAttribute('data-undo-set'))undo();
  });
  function keyboard(){const vv=window.visualViewport;if(!vv)return;const editing=/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||'');const inset=Math.max(0,innerHeight-vv.height-vv.offsetTop);document.body.classList.toggle('keyboard-open',editing&&inset>100);document.documentElement.style.setProperty('--keyboard-inset',`${inset}px`);}
  pane.addEventListener('focusin',event=>{if(event.target.id==='setKg'||event.target.id==='setReps')requestAnimationFrame(()=>event.target.scrollIntoView({block:'center',behavior:'smooth'}));});
  window.visualViewport?.addEventListener('resize',keyboard);window.visualViewport?.addEventListener('scroll',keyboard);document.addEventListener('focusout',()=>setTimeout(keyboard,60));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)paintAction();});
  pane.addEventListener('change',event=>{if(event.target.dataset.action==='variant'){const {ex}=current();log(ex).variant=event.target.value;persist();}});
  window.TrainingWorkspace={render,navigate,onRecordsChanged(){if(view==='stats')renderStats();},exportData:()=>({version:1,sessions}),restore(data){sessions=data?.version===1?normalizeSessions(data.sessions):{};stopRest();persist();},clearWeek(){sessions={};stopRest();persist();},diagnostics:()=>({view,date:selectedDate,exercise:selectedId,restEnd,sessionKey:KEY}),};
  render();navigate('train');
  if(Number.isFinite(saved.restEnd)&&saved.restEnd>Date.now()&&saved.restEnd<Date.now()+7200000)startRest((saved.restEnd-Date.now())/1000);
})();
