/* Original local Canvas 2.5D projection. No network, textures, WebGL or audio. */
(() => {
  'use strict';
  const palettes={
    ivory:['#7e887d','#c9d0bf','#fffbee','#e4e8d9','#a5b09d'],
    steel:['#182c25','#526e5f','#9aaf99','#526d5b','#233c30'],
    mint:['#215c4f','#4c9983','#c3efd6','#81c5a6','#386e5c'],
    coral:['#703c2c','#bd7050','#ffc294','#eaa47a','#9b553c'],
    dark:['#111f19','#23352b','#52664e','#354b39','#17271e']
  };
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  function elbow(s,h,u=.47,l=.44){
    const delta=h.map((v,i)=>v-s[i]),length=Math.hypot(...delta),d=Math.min(length,u+l-.001),unit=delta.map(v=>v/Math.max(.001,length));
    const a=(u*u-l*l+d*d)/(2*d),height=Math.sqrt(Math.max(0,u*u-a*a));
    let bend=[0,-1,0],dot=bend.reduce((v,x,i)=>v+x*unit[i],0);
    bend=bend.map((x,i)=>x-dot*unit[i]);const bl=Math.hypot(...bend)||1;
    return s.map((x,i)=>x+unit[i]*a+bend[i]/bl*height);
  }
  function draw(canvas,kind,q){
    if(!canvas || !canvas.isConnected)return;
    const dpr=Math.min(window.devicePixelRatio||1,2),w=480,h=310;
    const targetWidth=Math.max(280,Math.round(canvas.clientWidth||480)),targetHeight=Math.round(targetWidth*h/w);
    if(canvas.width!==targetWidth*dpr||canvas.height!==targetHeight*dpr){canvas.width=targetWidth*dpr;canvas.height=targetHeight*dpr;}
    const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);ctx.clearRect(0,0,w,h);
    const scale=87,front=kind==='lateral',project=p=>[235+(p[0]*(front?.38:.79)-p[2]*(front?.92:.61))*scale,(front?268:259)-p[1]*scale+(p[0]*(front?.30:.23)+p[2]*(front?.12:.30))*scale];
    const depth=p=>p[0]*.61+p[2]*.79+p[1]*.025;
    const light=ctx.createRadialGradient(290,50,3,270,90,280);light.addColorStop(0,'#75583b66');light.addColorStop(.42,'#4c49302b');light.addColorStop(1,'#10171300');ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
    const poly=(points,fill,stroke)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.7;ctx.stroke();}};
    const corners=[[-2,0,-1.5],[2,0,-1.5],[2,0,1.45],[-2,0,1.45]].map(project);
    poly([corners[1],corners[2],[corners[2][0],corners[2][1]+10],[corners[1][0],corners[1][1]+10]],'#0b110e','#374031');
    poly([corners[2],corners[3],[corners[3][0],corners[3][1]+10],[corners[2][0],corners[2][1]+10]],'#080e0b','#222f23');
    const floor=ctx.createLinearGradient(100,170,330,310);floor.addColorStop(0,'#343d2b');floor.addColorStop(.5,'#222e23');floor.addColorStop(1,'#101a14');poly(corners,floor,'#73836388');
    ctx.save();ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.clip();
    ctx.strokeStyle='#aab68a0e';ctx.lineWidth=.5;
    for(let i=-1.5;i<=2;i+=.5){ctx.beginPath();ctx.moveTo(...project([i,.005,-1.5]));ctx.lineTo(...project([i,.005,1.5]));ctx.stroke();}
    for(let i=-1;i<=1.5;i+=.5){ctx.beginPath();ctx.moveTo(...project([-2,.005,i]));ctx.lineTo(...project([2,.005,i]));ctx.stroke();}
    ctx.restore();
    const objects=[],shadows=[];
    const cap=(a,b,r,color='ivory',highlight=true)=>objects.push({type:'cap',a,b,r,color,highlight,d:(depth(a)+depth(b))/2});
    const ball=(p,r,color='ivory')=>objects.push({type:'ball',p,r,color,d:depth(p)});
    const cable=(a,b)=>objects.push({type:'cable',a,b,d:(depth(a)+depth(b))/2});
    const shadow=(p,r,alpha=.55)=>shadows.push({p,r,alpha});
    function tower(x,z){
      cap([x,.1,z-.18],[x,1.95,z-.18],.055,'steel');cap([x,.1,z+.18],[x,1.95,z+.18],.055,'steel');cap([x,1.95,z-.18],[x,1.95,z+.18],.065,'mint');
      cap([x-.24,.08,z-.30],[x+.26,.08,z+.30],.065,'steel');
      cap([x-.025,.2,z],[x-.025,1.8,z],.018,'steel');
      for(let n=0;n<6;n++)cap([x,.24+n*.075+q*.13,z-.13],[x,.24+n*.075+q*.13,z+.13],.038,n===5?'coral':'dark');
      ball([x,.18,z],.085,'mint');ball([x-.05,.67+q*.13,z+.06],.045,'coral');shadow([x,0,z],.40,.6);
    }
    const lateral=kind==='lateral',hip=lateral?[-.45,1.10,.05]:[-.60,.96,.05],bodyTop=lateral?[-.47,1.68,.05]:[-.64,1.53,.05];
    if(lateral)tower(-.60,-1.20);else tower(1.34,-.72);
    if(!lateral){
      cap([-.79,.72,-.33],[-.27,.72,.38],.075,'steel');
      cap([-.58,.12,-.23],[-.58,.70,-.23],.05,'steel');cap([-.58,.12,.32],[-.58,.70,.32],.05,'steel');
      cap([-.67,.79,-.29],[-.67,.79,.38],.13,'mint');
      shadow([-.55,0,.10],.58,.45);
      if(kind==='chest'){cap([-.89,.95,-.22],[-.89,1.58,-.22],.14,'mint');cap([-.89,.95,.29],[-.89,1.58,.29],.14,'mint');}
      else {cap([.57,.13,-.39],[.57,.38,-.39],.045,'steel');cap([.57,.13,.45],[.57,.38,.45],.045,'steel');}
    }
    for(const side of [-1,1]){
      const z=.05+side*.20;
      const knee=lateral?[-.46,.59,z+side*.04]:[.02,.89,z+side*.04];
      const foot=lateral?[-.43,.14,z+side*.15]:[.40,.15,z+side*.07];
      cap([hip[0],hip[1],z],knee,.145);cap(knee,foot,.125);ball(knee,.135);
      cap([foot[0]-.04,.12,foot[2]],[foot[0]+.19,.12,foot[2]],.125);shadow([foot[0]+.04,0,foot[2]],.26,.7);
    }
    cap(hip,bodyTop,.27);
    cap([bodyTop[0],bodyTop[1]+.04,.05],[bodyTop[0],bodyTop[1]+.24,.05],.13);
    ball([bodyTop[0]+.01,bodyTop[1]+.48,.05],.335);
    for(const side of [-1,1]){
      const shoulder=[bodyTop[0]+.02,bodyTop[1]-.025,.05+side*.245];let hand,e;
      if(lateral && side===1){
        const a=(1-q)*1.86;
        e=[shoulder[0]+.025,shoulder[1]-.42*Math.sin(a),shoulder[2]+.42*Math.cos(a)];
        hand=[e[0]+.06,e[1]-.39*Math.sin(a+.15),e[2]+.39*Math.cos(a+.15)];
        cable([-.60,.18,-1.20],hand);cap([hand[0]-.035,hand[1],hand[2]-.06],[hand[0]+.035,hand[1],hand[2]+.06],.045,'coral');
      }else if(lateral){e=[shoulder[0]-.03,shoulder[1]-.34,shoulder[2]-.18];hand=[-.57,1.02,-.55];}
      else{
        hand=kind==='row'?mix([.34,1.24,side*.11+.05],[-.35,1.20,side*.11+.05],q):mix([-.16,1.39,side*.32+.05],[.43,1.48,side*.25+.05],q);
        e=elbow(shoulder,hand,.46,.43);
        if(kind==='chest'){cap([1.13,1.88,side*.29-.25],hand,.04,'coral');}
        else if(side===1){cable([1.34,.18,-.72],hand);cap([hand[0],hand[1],hand[2]-.15],[hand[0],hand[1],hand[2]+.05],.04,'mint');}
      }
      cap(shoulder,e,.107);ball(e,.11);cap(e,hand,.093);ball(hand,.105);
    }
    // Small original colour plates and a warm reflection anchor the stage.
    cap([1.03,.11,.97],[1.44,.11,.97],.025,'steel');cap([1.07,.10,.87],[1.07,.10,1.07],.09,'coral');cap([1.41,.10,.87],[1.41,.10,1.07],.09,'mint');shadow([1.23,0,.97],.3,.55);
    function paint(object,reflect=false){
      const projectPoint=p=>project(reflect?[p[0],-p[1],p[2]]:p),colors=palettes[object.color]||palettes.ivory;
      if(object.type==='cable'){
        ctx.beginPath();ctx.moveTo(...projectPoint(object.a));ctx.lineTo(...projectPoint(object.b));ctx.strokeStyle='#e4ce9d';ctx.lineWidth=1.1;ctx.stroke();return;
      }
      if(object.type==='ball'){
        const p=projectPoint(object.p),r=object.r*scale;
        const gradient=ctx.createRadialGradient(p[0]-r*.28,p[1]-r*.40,r*.05,p[0]+r*.1,p[1]+r*.05,r*1.10);
        gradient.addColorStop(0,colors[2]);gradient.addColorStop(.50,colors[3]);gradient.addColorStop(.82,colors[1]);gradient.addColorStop(1,colors[0]);
        ctx.beginPath();ctx.arc(p[0],p[1],r,0,Math.PI*2);ctx.fillStyle=gradient;ctx.fill();
        if(!reflect){ctx.strokeStyle='#f2dfb022';ctx.lineWidth=.65;ctx.stroke();}return;
      }
      const a=projectPoint(object.a),b=projectPoint(object.b),r=object.r*scale,dx=b[0]-a[0],dy=b[1]-a[1],len=Math.max(.1,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len,m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      const gradient=ctx.createLinearGradient(m[0]-nx*r,m[1]-ny*r,m[0]+nx*r,m[1]+ny*r);
      [0,.21,.47,.73,1].forEach((t,i)=>gradient.addColorStop(t,colors[i]));
      ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=gradient;ctx.lineWidth=r*2;ctx.lineCap='round';ctx.stroke();
      if(!reflect&&object.highlight){ctx.beginPath();ctx.moveTo(a[0]+nx*r*.28,a[1]+ny*r*.28);ctx.lineTo(b[0]+nx*r*.28,b[1]+ny*r*.28);ctx.strokeStyle=object.color==='ivory'?'#fffbe61a':'#e7f8d318';ctx.lineWidth=Math.max(.7,r*.08);ctx.stroke();}
    }
    objects.sort((a,b)=>a.d-b.d);
    ctx.save();ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.clip();ctx.globalAlpha=.045;objects.forEach(o=>paint(o,true));ctx.restore();
    shadows.forEach(({p,r,alpha})=>{const point=project(p);ctx.save();ctx.translate(...point);ctx.scale(1,.36);const gradient=ctx.createRadialGradient(0,0,r*scale*.1,0,0,r*scale);gradient.addColorStop(0,`rgba(0,5,2,${alpha})`);gradient.addColorStop(1,'rgba(0,5,2,0)');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,r*scale,0,Math.PI*2);ctx.fill();ctx.restore();});
    objects.forEach(o=>paint(o));
    const glow=ctx.createRadialGradient(380,12,0,380,12,160);glow.addColorStop(0,'#f3c38413');glow.addColorStop(1,'#f3c38400');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  }
  window.ToyRenderer={draw};
})();
