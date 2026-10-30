/* Static pose / qualitative muscle references. Browsing never edits records. */
(() => {
  'use strict';
  const catalog=window.FitnessReferenceData, byId=new Map(catalog.map(item=>[item.id,item]));
  const mapping={a_legpress:['F01','F02','F03'],a_chest:['F04','F05'],a_row:['F06'],a_legcurl:['F07'],a_arms:['F08','F09'],a_crunch:['F10'],a_cardio:['F11','F12'],b_squat:['F03','F01'],b_pulldown:['F13','F14'],b_shoulder:['F15'],b_legext:['F16'],b_side:['F17','F18'],b_arms:['F08','F09'],b_plank:['F19','F20'],b_cardio:['F11','F12'],c_rdl:['F21','F22'],c_incline:['F23'],c_onerow:['F24','F25'],c_hip:['F26','F27'],c_lateral:['F17'],c_arms:['F08','F09'],c_crunch:['F10','F28'],c_cardio:['F11','F12'],wu0:['F11','F12','W01','W02','W03','W04'],wu1:['F01','F04','F06']};
  const selections=new Map();
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function idsFor(ex){return mapping[typeof ex==='string'?ex:ex.id]||[];}
  function card(ex,compact=false){
    const ids=idsFor(ex);if(!ids.length)return '';
    const gallery=`<div class="reference-gallery" data-reference="${safe(ex.id)}" data-reference-ids="${ids.join(',')}"></div>`;
    return compact?`<details class="reference-details"><summary>姿势与肌群参考 <span>${ids.length>1?'含可选变式':'静态图集'}</span></summary>${gallery}</details>`:gallery;
  }
  function paint(root,focus=null){
    const key=root.dataset.reference,ids=root.dataset.referenceIds.split(',');
    let selected=selections.get(key)||{id:ids[0],kind:'pose'};
    if(!ids.includes(selected.id))selected={id:ids[0],kind:'pose'};
    selections.set(key,selected);
    const item=byId.get(selected.id),kind=selected.kind,img=item[kind],isPose=kind==='pose';
    root.innerHTML=`<div class="reference-controls"><label><span>${ids.length>1?'选择动作 / 变式':'当前示范'}</span><select data-reference-choice aria-label="参考动作变式">${ids.map(id=>`<option value="${id}" ${id===item.id?'selected':''}>${safe(byId.get(id).name)}</option>`).join('')}</select></label><div class="reference-tabs" aria-label="参考图类型">${[['pose','姿势'],['muscle','肌群']].map(([id,label])=>`<button type="button" data-reference-kind="${id}" aria-pressed="${kind===id}">${label}</button>`).join('')}</div></div>
      <div class="reference-image-wrap"><img class="zoomable reference-image" role="button" tabindex="0" src="${img.thumb.src}" data-full-src="${img.full.src}" width="${img.thumb.width}" height="${img.thumb.height}" loading="lazy" decoding="async" alt="${safe(item.name)}${isPose?'姿势参考':'肌群区域示意'}${isPose&&item.pending?'（待确认）':''}" aria-label="放大查看：${safe(item.name)}${isPose?'姿势参考':'肌群区域示意'}"/><div class="reference-image-error" role="status" hidden>图片暂未加载。文字指导仍可使用；联网后可重试。<button type="button" data-reference-retry>重新加载</button></div><span class="reference-enlarge" aria-hidden="true">⤢ 点图放大</span></div>
      <div class="reference-caption"><span class="reference-status ${isPose&&item.pending?'pending':''}">${isPose?(item.pending?'待确认 · 器械细节尚待复核':'AI 静态姿势参考'):'定性肌群区域示意'}</span><p>${safe(isPose?item.variant:item.muscleVariant)}</p>${!isPose&&item.id==='F20'?'<p class="reference-warning">仅展示仰卧、四肢抬起的起始位，不是完整死虫动作。</p>':''}<p class="reference-limit">${safe(isPose?item.limits:'颜色不表示 EMG 或用力百分比；箭头仅定性，非精确解剖或实测受力。')}</p>
      ${!isPose?`<details class="reference-muscles"><summary>${item.id.startsWith('W')||['F11','F12'].includes(item.id)?'参与肌群与控制':'目标、协同与稳定肌群'}</summary><p>主要目标：${safe(item.primary.join('、'))}</p><p>协同参与：${safe(item.secondary.join('、')||'见图中文字')}</p><p>稳定参与：${safe(item.stabilizers.join('、'))}</p></details>`:''}
      <details class="reference-evidence"><summary>图集说明与资料</summary><p>AI 生成的视觉参考，保留原训练文字指导。姿势图 26 项视觉检查通过、6 项待确认；肌群图复核不代表器械连续性通过，也不属于专业认证。</p>${(isPose?item.sources:item.muscleSources).map((url,i)=>`<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">动作原理资料 ${i+1} ↗</a>`).join('')||'<p>此姿势图未记录逐动作外部来源。</p>'}</details></div>`;
    root.querySelector('img').addEventListener('error',()=>{root.querySelector('.reference-image-error').hidden=false;root.querySelector('.reference-enlarge').hidden=true;});
    if(focus==='choice')root.querySelector('select').focus({preventScroll:true});
    else if(focus)root.querySelector(`[data-reference-kind="${focus}"]`).focus({preventScroll:true});
  }
  function mount(scope=document){scope.querySelectorAll('.reference-gallery').forEach(root=>{if(!root.children.length&&!root.closest('details:not([open])'))paint(root);});}
  document.addEventListener('toggle',event=>{if(event.target.matches?.('.reference-details')&&event.target.open)mount(event.target);},true);
  document.addEventListener('change',event=>{if(!event.target.matches('[data-reference-choice]'))return;const root=event.target.closest('.reference-gallery'),value=selections.get(root.dataset.reference);selections.set(root.dataset.reference,{...value,id:event.target.value});paint(root,'choice');});
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    const root=button.closest('.reference-gallery');
    if(root&&button.dataset.referenceKind){const value=selections.get(root.dataset.reference);selections.set(root.dataset.reference,{...value,kind:button.dataset.referenceKind});paint(root,button.dataset.referenceKind);}
    if(root&&button.hasAttribute('data-reference-retry'))paint(root);
  });
  let trigger=null,oldOverflow='',inert=[];
  const library=document.createElement('section');library.id='referenceLibrary';library.hidden=true;library.setAttribute('role','dialog');library.setAttribute('aria-modal','true');library.setAttribute('aria-label','完整动作图集');
  library.innerHTML=`<div class="reference-library-sheet"><header><div><small>REFERENCE LIBRARY · 32 动作</small><h2>动作图集</h2></div><button type="button" data-close-library aria-label="返回训练">返回训练 ✕</button></header><p class="library-intro">先选择动作，再切换姿势或肌群。浏览不会更改训练记录。</p><div class="reference-gallery" data-reference="library" data-reference-ids="${catalog.map(item=>item.id).join(',')}"></div></div>`;
  document.body.append(library);
  function openLibrary(button){
    if(!library.hidden)return;trigger=button||document.activeElement;oldOverflow=document.body.style.overflow;
    inert=[...document.querySelectorAll('.wrap,#workbenchNav,#trainActionBar')].map(el=>({el,value:el.inert}));inert.forEach(({el})=>el.inert=true);
    document.body.style.overflow='hidden';library.hidden=false;mount(library);library.querySelector('[data-close-library]').focus();
  }
  function closeLibrary(){if(library.hidden)return;library.hidden=true;document.body.style.overflow=oldOverflow;inert.forEach(({el,value})=>el.inert=value);if(trigger?.isConnected)trigger.focus({preventScroll:true});trigger=null;}
  document.addEventListener('click',event=>{const button=event.target.closest('button');if(button?.hasAttribute('data-open-library'))openLibrary(button);if(button?.hasAttribute('data-close-library')||event.target===library)closeLibrary();});
  document.addEventListener('keydown',event=>{
    if(document.getElementById('lightbox').classList.contains('open')){
      if(event.key==='Tab'&&document.getElementById('lightboxImg').src.includes('/assets/reference/')){
        event.preventDefault();event.stopImmediatePropagation();
        const close=document.getElementById('lightboxClose');
        (document.activeElement===close?zoom:close).focus();
      }
      return;
    }
    if(library.hidden)return;
    if(event.key==='Escape'){event.preventDefault();closeLibrary();}
    if(event.key==='Tab'){
      const focusable=[...library.querySelectorAll('button,select,img[tabindex],summary,a[href]')].filter(el=>el.getClientRects().length),first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  const lightbox=document.getElementById('lightbox'),large=document.getElementById('lightboxImg');
  const zoom=document.createElement('button');zoom.type='button';zoom.className='reference-zoom';zoom.setAttribute('data-reference-zoom','');zoom.textContent='放大细节 ＋';zoom.setAttribute('aria-pressed','false');
  const status=document.createElement('p');status.className='reference-lightbox-status';status.setAttribute('role','status');
  lightbox.append(zoom,status);
  zoom.addEventListener('click',()=>{const on=lightbox.classList.toggle('reference-zoomed');zoom.textContent=on?'适合屏幕 －':'放大细节 ＋';zoom.setAttribute('aria-pressed',String(on));});
  large.addEventListener('load',()=>status.textContent='');large.addEventListener('error',()=>{if(lightbox.classList.contains('open'))status.textContent='清晰图加载失败。可返回查看预览，或联网后再次打开。';});
  new MutationObserver(()=>{if(!lightbox.classList.contains('open')){if(lightbox.classList.contains('reference-zoomed'))lightbox.classList.remove('reference-zoomed');zoom.textContent='放大细节 ＋';zoom.setAttribute('aria-pressed','false');status.textContent='';}}).observe(lightbox,{attributes:true,attributeFilter:['class']});
  window.TrainingReferences={card,mount,idsFor,openLibrary,catalog};
})();
