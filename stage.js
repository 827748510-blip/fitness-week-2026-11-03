/* Original SVG artwork and deterministic joint animation. All assets stay local. */
(() => {
  'use strict';
  const PREF_KEY = 'fitness-guide-preferences-v1';
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let preferences = {slow:false, reduce:false};
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    preferences = {slow:saved.slow === true, reduce:saved.reduce === true};
  } catch (_) { /* Storage is optional for guide preferences. */ }
  let players = new Map(), active = null, raf = 0, lastFrame = 0;
  const playback = new Map();
  let rest = null, restInterval = 0;
  const reduced = () => media.matches || preferences.reduce;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons = {
    arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
    mark:'<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="10" fill="#f3b66f"/><path d="M9 16h14M8 12v8m4-10v12m8-12v12m4-10v8" stroke="#1a211a" stroke-width="2.4" stroke-linecap="round"/></svg>',
    buddy:'<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="59" rx="19" ry="3" fill="#0e150e"/><path d="M25 43l-3 12m16-12 4 12M22 30l-9 8m28-8 10-9" fill="none" stroke="#c8cbbf" stroke-width="9" stroke-linecap="round"/><rect x="22" y="25" width="21" height="23" rx="10" fill="#f4f1e8"/><circle cx="32" cy="17" r="12" fill="#f4f1e8"/><path d="M48 13l6-3m-4 10h8" stroke="#f3b66f" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  const guides = {
    a_row: {
      name:'坐姿绳索划船', variant:'低位绳索 · 双臂窄握', kind:'row', rest:90,
      source:'https://www.acefitness.org/resources/everyone/exercise-library/48/seated-row/', sourceName:'ACE · Seated Row',
      phases:[['准备','坐稳、脚踏实，背部自然伸直，双手握住窄把。'],['向后拉','肘靠近肋侧向后，手柄拉向腹部；躯干保持稳定。'],['短暂停顿','肩胛自然后收，不耸肩、不后仰借力。'],['控制还原','缓慢伸臂回到起点，不向前塌肩。']]
    },
    a_chest: {
      name:'坐姿器械胸推', variant:'有靠背 · 双臂器械胸推', kind:'chest', rest:120,
      source:'https://www.acefitness.org/resources/everyone/exercise-library/188/seated-chest-press/', sourceName:'ACE · Seated Chest Press',
      phases:[['准备','调座位使手柄在胸中部，背靠垫、脚踩稳，手腕中立。'],['向前推','呼气向前推，保持肩胛与靠垫接触，不拱腰。'],['接近伸展','肘接近伸直但不锁死，肩膀不向前顶。'],['控制还原','缓慢屈肘，手柄回到胸前，不向后超伸。']]
    },
    c_lateral: {
      name:'单臂绳索侧平举', variant:'低位跨体 · 单臂示范', kind:'lateral', rest:60,
      source:'https://www.muscleandstrength.com/exercises/one-arm-cable-lateral-raise.html', sourceName:'Muscle & Strength · 单臂绳索侧平举',
      phases:[['准备','低位滑轮，手从身前跨体握把；站稳，肘保持微屈。'],['向侧上举','手臂向侧方抬起，躯干稳定，避免耸肩或甩动。'],['肩高附近','抬至肩高附近的舒适范围，不锁死肘。'],['控制下放','沿原路径缓慢回落；另一侧也需完成原计划。']]
    }
  };
  const phaseStarts = [0, .15, .4, .55];
  function phaseAt(t) { return t < .15 ? 0 : t < .4 ? 1 : t < .55 ? 2 : 3; }
  function amount(t) {
    if (t < .15) return 0;
    if (t < .4) return .5 - .5 * Math.cos(Math.PI * (t - .15) / .25);
    if (t < .55) return 1;
    return .5 + .5 * Math.cos(Math.PI * (t - .55) / .45);
  }
  function defs(id) {
    return `<defs>
      <radialGradient id="${id}-light" cx="65%" cy="${id === 'home-stage' ? '38%' : '0%'}" r="${id === 'home-stage' ? '50%' : '95%'}"><stop stop-color="#695139" stop-opacity=".7"/><stop offset=".65" stop-color="#1a2119" stop-opacity=".2"/><stop offset="1" stop-color="#111612" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2=".35"><stop stop-color="#a5a89c"/><stop offset=".35" stop-color="#e4e4d7"/><stop offset=".66" stop-color="#fffaf0"/><stop offset="1" stop-color="#d7d8c9"/></linearGradient>
      <radialGradient id="${id}-head" cx="68%" cy="25%" r="80%"><stop stop-color="#fffef5"/><stop offset=".6" stop-color="#eeebdf"/><stop offset="1" stop-color="#a7aa9d"/></radialGradient>
      <linearGradient id="${id}-floor" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#34392b"/><stop offset="1" stop-color="#171e18"/></linearGradient>
      <linearGradient id="${id}-metal"><stop stop-color="#4a5447"/><stop offset=".4" stop-color="#85917c"/><stop offset="1" stop-color="#3d473b"/></linearGradient>
    </defs>`;
  }
  function floor(id) {
    return `<rect width="480" height="300" fill="url(#${id}-light)"/>
      <path d="M17 225 276 184 468 239 208 290Z" fill="#0a100d"/>
      <path d="M17 215 276 174 468 229 208 280Z" fill="url(#${id}-floor)" stroke="#62644b" stroke-width=".7"/>
      <path d="M17 215v10l191 65v-10m260-51v10" fill="none" stroke="#2b3528"/>
      <path d="m60 224 247-40m-189 60 248-40m-190 60 246-40" stroke="#aeb987" stroke-opacity=".07"/>
      <ellipse cx="246" cy="232" rx="83" ry="17" fill="#e6b774" opacity=".07"/>
      <ellipse cx="238" cy="233" rx="64" ry="9" fill="#050b07" opacity=".65"/>`;
  }
  function limb(id, name, d, far = false, width = 17) {
    return `<path data-joint="${name}" d="${d}" fill="none" stroke="${far ? '#929b8c' : `url(#${id}-body)`}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  function tower(id, x) {
    return `<g><path d="M${x} 214V78l34-7v136" fill="none" stroke="url(#${id}-metal)" stroke-width="8" stroke-linejoin="round"/>
      <path d="m${x-9} 218 52-8" stroke="#55644c" stroke-width="9" stroke-linecap="round"/>
      <path d="M${x+14} 91v112" stroke="#aab09c" stroke-width="2"/>
      <g data-stack>${[0,1,2,3,4].map(n=>`<path d="m${x+4} ${188-n*8} 21-4 7 5-21 4Z" fill="${n===4?'#f3b66f':'#45533c'}" stroke="#83906f" stroke-width=".5"/>`).join('')}</g>
      <circle cx="${x+20}" cy="206" r="6" fill="#d2b27f"/><circle cx="${x+20}" cy="206" r="2" fill="#303b2a"/></g>`;
  }
  function scene(kind,id) {
    return `<canvas class="guide-canvas" width="960" height="620" role="img" aria-label="${kind} 动作示意，Canvas 2.5D 投影">你的浏览器未提供 Canvas，请查看原姿势参考图。</canvas>`;
  }
  function hero() {
    const id = 'home-stage';
    const buddy = (x,y,s,far) => `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="4" cy="114" rx="34" ry="9" fill="#050b07" opacity=".6"/>
      ${limb(id,'','M-8 66-19 103-29 108',true,19)}${limb(id,'','M13 66 22 101 32 106',far,20)}
      ${limb(id,'','M-14 16-30 42-25 62',true,15)}
      <path d="M0 15 3 65" stroke="url(#${id}-body)" stroke-width="38" stroke-linecap="round"/>
      <ellipse cy="-21" rx="27" ry="29" fill="url(#${id}-head)"/>
      ${limb(id,'','M18 16 34 39 28 61',far,16)}
      <path d="m-28 63 57-2" stroke="#b4c0a6" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="-29" cy="62" rx="7" ry="18" fill="#71b39c"/><ellipse cx="30" cy="60" rx="7" ry="18" fill="#ef9679"/>
      <ellipse cx="-34" cy="63" rx="4" ry="14" fill="#a8d8bf"/><ellipse cx="35" cy="61" rx="4" ry="14" fill="#ffc09d"/></g>`;
    return `<svg viewBox="0 0 480 320" role="img" aria-label="暖光训练舞台上的两个白色圆头伙伴，手持彩色小杠铃">
      ${defs(id)}${floor(id)}
      <path d="m320 20-80 180 160 22Z" fill="#eec388" opacity=".035"/>
      ${buddy(293,117,.7,true)}${buddy(192,119,1,false)}
      <g transform="translate(357 234) rotate(-10)"><ellipse rx="27" ry="7" fill="#060d08"/><path d="M-25 0h50" stroke="#c5c9b8" stroke-width="4"/><ellipse cx="-22" rx="5" ry="15" fill="#ef9679"/><ellipse cx="22" rx="5" ry="15" fill="#71b39c"/></g>
      <path d="m348 107 13-12m-5 24 18-3" fill="none" stroke="#e6c48f" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    </svg><p class="scene-caption">SMALL STEPS. STRONGER TOGETHER.</p>`;
  }
  function card(date, exercise) {
    const g = guides[exercise.id];
    if (!g) return '';
    const id = `${date}-${exercise.id}`;
    const variants = exercise.id === 'a_chest' ? `<label class="guide-variant">当前变式 <select data-action="variant" aria-label="胸推动作变式"><option value="machine">器械胸推 · 动画</option><option value="smith">史密斯卧推 · 暂无示范</option></select></label>` : `<div class="guide-variant">当前示范：${g.variant}</div>`;
    return `<section class="guide" data-guide="${id}" data-exercise="${exercise.id}" aria-label="${g.name}动作引导">
      <div class="guide-top"><i class="guide-dot" aria-hidden="true"></i><strong>小人动作引导</strong><span>2.5D · 自动循环</span></div>
      ${variants}
      <div class="guide-animation"><div class="guide-stage"><span class="guide-watermark" aria-hidden="true">FORM / ${g.kind.toUpperCase()}</span>${scene(g.kind,id)}</div>
      <p class="guide-note"><span class="motion-explanation">无声自动循环 · 离屏或后台暂停 · 可随时暂停</span></p>
      <div class="guide-controls">
        <div class="guide-transport"><button type="button" class="guide-play" data-action="play">暂停示范</button><button type="button" data-action="slow" aria-pressed="${preferences.slow}">0.5× 慢放</button><button type="button" data-action="prev" aria-label="上一步动作阶段">上一步</button><button type="button" data-action="next" aria-label="下一步动作阶段">下一步</button></div>
        <div class="guide-phase"><strong data-phase-number>01 / 04</strong><span data-phase-name>准备</span><p data-phase-cue>${g.phases[0][1]}</p></div>
        <input class="guide-scrub" type="range" min="0" max="1000" value="0" step="1" data-action="scrub" aria-label="动作示范进度" aria-valuetext="准备"/>
        <div class="guide-scrub-label"><span>准备</span><span>发力</span><span>停顿</span><span>还原</span></div>
        <div class="guide-footer"><button type="button" class="guide-rest" data-action="rest">开始休息 ${g.rest} 秒</button><output class="guide-rest-clock" aria-label="剩余休息时间" aria-live="off"></output><button type="button" class="guide-rest" data-action="cancel-rest" hidden>结束计时</button><span class="guide-rest-status" role="status"></span></div>
        <span class="guide-status" role="status"></span>
      </div></div>
      <div class="guide-static" hidden><p class="guide-note" style="margin-top:16px">史密斯卧推暂无匹配的动画或姿势图。请根据实际器械与现场指导确认动作。下方原图仅适用于坐姿器械胸推，不能作为史密斯卧推示范。训练记录仍归原项目。</p></div>
      <a class="guide-source" href="${g.source}" target="_blank" rel="noopener noreferrer">动作依据：${g.sourceName} ↗</a>
      <details class="static-guide" style="margin:0 14px"><summary>${exercise.id === 'a_chest' ? '查看器械胸推原图（不适用于史密斯）' : '查看原姿势参考图'}</summary><img class="zoomable" role="button" tabindex="0" aria-label="放大查看：${escape(g.name)} 姿势图" src="${escape(exercise.img)}" alt="${escape(g.name)} 原姿势图" loading="lazy"/></details>
    </section>`;
  }
  function ik(s, h, upper=46, lower=46) {
    const dx=h[0]-s[0], dy=h[1]-s[1], distance=Math.max(.1,Math.hypot(dx,dy));
    const d=Math.min(distance,upper+lower-.1), a=(upper*upper-lower*lower+d*d)/(2*d);
    const height=Math.sqrt(Math.max(0,upper*upper-a*a));
    const e=[s[0]+dx/distance*a-dy/distance*height,s[1]+dy/distance*a+dx/distance*height];
    return `M${s} ${e.map(n=>n.toFixed(2))} ${h.map(n=>n.toFixed(2))}`;
  }
  function pose(player) {
    const {root,g,t}=player,q=amount(t),phase=phaseAt(t);
    if(window.ToyRenderer) window.ToyRenderer.draw(root.querySelector('canvas'),g.kind,q);
    if(player.phase!==phase){
      player.phase=phase;
      root.querySelector('[data-phase-number]').textContent=`0${phase+1} / 04`;
      root.querySelector('[data-phase-name]').textContent=g.phases[phase][0];
      root.querySelector('[data-phase-cue]').textContent=g.phases[phase][1];
      root.querySelector('canvas').setAttribute('aria-label',`${g.name}：${g.phases[phase][0]}，2.5D 动作示意`);
      root.querySelector('.guide-scrub').setAttribute('aria-valuetext',g.phases[phase][0]);
    }
    root.querySelector('.guide-scrub').value=Math.round(t*1000);
  }
  function announce(player,text) { player.root.querySelector('.guide-status').textContent=text; }
  function stop(message) {
    cancelAnimationFrame(raf);raf=0;lastFrame=0;
    if(active){active.playing=false;active.root.dataset.playing='false';if(message)announce(active,message);}
    active=null;
    players.forEach(p=>{const button=p.root.querySelector('[data-action="play"]');button.textContent=reduced()?'分步查看':p.manualPause?'继续示范':'暂停示范';button.disabled=reduced();});
  }
  function choose(){
    if(document.hidden||reduced()){stop();return;}
    let best=null,score=0;
    players.forEach(p=>{
      if(p.manualPause||p.root.querySelector('.guide-animation').hidden||!p.root.getClientRects().length)return;
      const r=p.root.querySelector('canvas').getBoundingClientRect();
      const visible=Math.max(0,Math.min(r.bottom,innerHeight-70)-Math.max(r.top,70));
      if(r.width>0&&visible>40&&visible>score){best=p;score=visible;}
    });
    if(best===active)return;
    stop();if(!best)return;
    active=best;best.playing=true;best.root.dataset.playing='true';best.root.querySelector('[data-action="play"]').textContent='暂停示范';raf=requestAnimationFrame(frame);
  }
  let selectionFrame=0;
  function refresh(){if(!selectionFrame)selectionFrame=requestAnimationFrame(()=>{selectionFrame=0;choose();});}
  function frame(now){
    if(!active)return;
    if(lastFrame&&now-lastFrame<33){raf=requestAnimationFrame(frame);return;}
    const dt=lastFrame?Math.min(now-lastFrame,100):0;lastFrame=now;
    active.t=(active.t+dt/(preferences.slow?13600:6800))%1;pose(active);raf=requestAnimationFrame(frame);
  }
  function setPreferences(){
    document.documentElement.classList.toggle('reduce-motion',reduced());
    try{localStorage.setItem(PREF_KEY,JSON.stringify(preferences));}catch(_){}
    document.querySelectorAll('[data-action="slow"]').forEach(b=>b.setAttribute('aria-pressed',String(preferences.slow)));
    const button=document.getElementById('motionSetting');if(button){button.textContent=`减少动态：${reduced()?'开':'关'}`;button.setAttribute('aria-pressed',String(reduced()));}
    document.querySelectorAll('.motion-explanation').forEach(el=>el.textContent=reduced()?'已遵循减少动态设置，可用分步查看姿势。':'无声自动循环 · 离屏或后台暂停 · 可随时暂停');
    stop();refresh();
  }
  function clearRest(message='') {
    clearInterval(restInterval);restInterval=0;
    if(rest) {
      rest.root.querySelector('.guide-rest-clock').textContent='';
      rest.root.querySelector('[data-action="cancel-rest"]').hidden=true;
      rest.root.querySelector('.guide-rest-status').textContent=message;
    }
    rest=null;
  }
  function tickRest() {
    if(!rest) return;
    const remaining=Math.max(0,Math.ceil((rest.end-Date.now())/1000));
    rest.root.querySelector('.guide-rest-clock').textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
    if(!remaining) clearRest('休息结束，准备好后再开始。');
  }
  function mount() {
    players.forEach((player,id)=>playback.set(id,{t:player.t,manualPause:player.manualPause}));
    stop();clearRest();players.clear();
    document.querySelectorAll('.guide').forEach(root=>{
      const g=guides[root.dataset.exercise];
      const saved=playback.get(root.dataset.guide);
      const player={root,g,t:saved?.t||0,phase:-1,playing:false,manualPause:saved?.manualPause||false};players.set(root.dataset.guide,player);pose(player);
    });
    const home=document.getElementById('heroScene');if(home && !home.firstElementChild) home.innerHTML=hero();
    const mark=document.querySelector('.weekly-mark');if(mark && !mark.firstElementChild) mark.innerHTML=icons.buddy;
    setPreferences();
    if(observer) {observer.disconnect();players.forEach(p=>observer.observe(p.root));}
    refresh();
  }
  function feedback(state) {
    const el=document.getElementById('weeklyFeedback');if(!el) return;
    const entries=Object.values(state.days),done=entries.filter(d=>d.done).length;
    const checks=entries.reduce((n,d)=>n+Object.values(d.exercises||{}).filter(e=>e.done).length+(d.cardioDone?1:0),0);
    const level=done===7?'complete':done>=3?'steady':(done||checks)?'started':'ready';
    el.dataset.level=level;
    const mark=el.querySelector('.weekly-mark');
    // The companion's gesture and award follow confirmed records only.
    const gesture=done>=3?'M22 30 12 18m29 12 11-13':(done||checks)?'M22 30l-9 8m28-8 10-9':'M22 30l-9 8m28-8 9 8';
    mark.innerHTML=icons.buddy.replace('M22 30l-9 8m28-8 10-9',gesture).replace('</svg>',done===7?'<circle cx="32" cy="36" r="5" fill="#f3b66f"/><path d="m30 36 2 2 3-4" fill="none" stroke="#293125" stroke-width="1.5"/></svg>':'</svg>');
    el.querySelector('[data-week-number]').textContent=done;
    el.querySelector('[data-week-message]').textContent=done===0?(checks?`已确认 ${checks} 项训练，伙伴陪你稳稳向前。`:'从一次认真完成开始，伙伴陪你一起练。'):`你已亲手确认 ${done} 天完成，继续按自己的节奏。`;
    el.querySelector('[data-week-title]').textContent=done===7?'这一周，好好练过了':'每次完成，都算成长';
    el.querySelector('.week-dots').innerHTML=Object.entries(state.days).map(([date,d])=>`<span class="week-dot ${d.done?'complete':''}" title="${date}：${d.done?'已确认完成':'未确认完成'}"></span>`).join('');
    el.querySelector('.week-dots').setAttribute('aria-label',`本周已手动确认完成 ${done} 天，共 ${entries.length} 天`);
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button) return;
    const root=button.closest('.guide');if(!root) return;
    const player=players.get(root.dataset.guide);if(!player) return;
    const action=button.dataset.action;
    if(action==='play') {
      if(reduced())return;
      player.manualPause=active===player||!player.manualPause;
      if(player.manualPause)stop('示范已暂停。');
      else announce(player,'正在循环播放动作示意，不会记录训练完成。');
      refresh();
    } else if(action==='slow') {
      preferences.slow=!preferences.slow;
      // Update only preference controls, keeping the current playback state.
      try {localStorage.setItem(PREF_KEY,JSON.stringify(preferences));} catch (_) {}
      document.querySelectorAll('[data-action="slow"]').forEach(b=>b.setAttribute('aria-pressed',String(preferences.slow)));
      announce(player,preferences.slow?'已切换为半速示范。':'已切换为正常示范速度。');
    } else if(action==='next'||action==='prev') {
      player.manualPause=true;stop();const current=phaseAt(player.t),next=(current+(action==='next'?1:3))%4;
      player.t=phaseStarts[next]+.001;
      // Show the meaningful endpoint of the exertion / return phase when stepping.
      if(next===1) player.t=.32;if(next===3) player.t=.82;
      pose(player);announce(player,`第${next+1}阶段：${player.g.phases[next].join('，')}`);
    } else if(action==='rest') {
      clearRest('已切换休息计时。');
      rest={root,end:Date.now()+player.g.rest*1000};root.querySelector('.guide-rest-status').textContent='计时只作提醒；完成训练需手动确认。';root.querySelector('[data-action="cancel-rest"]').hidden=false;tickRest();restInterval=setInterval(tickRest,250);
    } else if(action==='cancel-rest') clearRest('计时已结束。');
  });
  document.addEventListener('input',event=>{
    if(event.target.dataset.action!=='scrub') return;
    const root=event.target.closest('.guide'),player=players.get(root.dataset.guide);if(!player) return;
    player.manualPause=true;stop();player.t=Math.min(.999,Number(event.target.value)/1000);pose(player);
  });
  document.addEventListener('change',event=>{
    if(event.target.dataset.action!=='variant') return;
    const root=event.target.closest('.guide');stop('变式已切换。');
    if(rest && rest.root===root) clearRest('变式切换，计时已结束。');
    const machine=event.target.value==='machine';
    root.querySelector('.guide-animation').hidden=!machine;root.querySelector('.guide-static').hidden=machine;
    root.querySelector('.guide-source').hidden=!machine;
    refresh();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else{tickRest();refresh();}});
  window.addEventListener('scroll',refresh,{passive:true});
  window.addEventListener('resize',()=>{players.forEach(p=>pose(p));refresh();},{passive:true});
  const observer='IntersectionObserver' in window?new IntersectionObserver(refresh,{threshold:[0,.15,.5,1]}):null;
  media.addEventListener('change',setPreferences);
  window.TrainingStage={
    card, mount, feedback, guides, refresh,
    diagnostics:()=>({active:active?.root.dataset.guide||null,playing:[...players.values()].filter(p=>p.playing).length}),
    pause:()=>{stop();refresh();},
    toggleMotion(){preferences.reduce=!preferences.reduce;setPreferences();},
    icons
  };
})();
