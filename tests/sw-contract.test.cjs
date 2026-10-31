// No browser worker or real network is used. Execute the actual worker script
// against a synthetic cache/fetch to verify offline and cache ownership behavior.
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('SW precache serves every current local asset offline and preserves foreign caches',async()=>{
  const root=path.join(__dirname,'..'),origin='http://synthetic.invalid';
  const handlers={},stores=new Map([['unrelated-user-cache',new Map()],['fitness-week-2026-11-03-old',new Map()]]);
  let offline=false,fetches=0,claimed=false,skipped=false;
  const key=value=>new URL(typeof value==='string'?value:value.url,origin+'/').href;
  const localFetch=async request=>{
    fetches++;
    if(offline)throw TypeError('synthetic offline');
    const url=new URL(key(request));assert.equal(url.origin,origin);
    const rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
    return new Response(fs.readFileSync(path.join(root,rel)),{status:200});
  };
  const caches={
    async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);},
    async open(name){
      if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
      return {async addAll(assets){for(const asset of assets)store.set(key(asset),await localFetch(asset));},async put(req,res){store.set(key(req),res);},async match(req){return store.get(key(req))?.clone();}};
    },async match(req){for(const store of stores.values()){const res=store.get(key(req));if(res)return res.clone();}}
  };
  const self={location:{origin},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{skipped=true;},clients:{claim:async()=>{claimed=true;}}};
  const context=vm.createContext({self,caches,fetch:localFetch,URL});vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);
  let waiting;handlers.install({waitUntil:p=>waiting=p});await waiting;assert.equal(skipped,true);
  handlers.activate({waitUntil:p=>waiting=p});await waiting;assert.equal(claimed,true);
  assert(stores.has('unrelated-user-cache'));assert(!stores.has('fitness-week-2026-11-03-old'));
  const assets=vm.runInContext('ASSETS',context);assert(assets.includes('./workspace.js')&&assets.includes('./toy-renderer.js'));
  offline=true;
  for(const asset of assets){let response;handlers.fetch({request:{method:'GET',url:key(asset)},waitUntil(){},respondWith:p=>response=p});const res=await response;assert.equal(res.status,200);assert((await res.arrayBuffer()).byteLength>0);}
  let postIntercepted=false;handlers.fetch({request:{method:'PUT',url:origin+'/synthetic'},respondWith:()=>postIntercepted=true});assert.equal(postIntercepted,false);
  assert.equal(fetches,assets.length*2);
});

test('active SW uses only its named cache and a late response cannot reopen a deleted cache',async()=>{
  const handlers={},origin='http://synthetic.invalid',url=origin+'/index.html';let opened=0,release,background,response;
  const activeStore=new Map([[url,new Response('active-version')]]),named=new Map();
  const self={location:{origin},addEventListener:(name,fn)=>handlers[name]=fn};
  const caches={async match(){return new Response('stale-other-version');},async open(name){opened++;if(!named.has(name))named.set(name,activeStore);const store=named.get(name);return {async match(req){return store.get(req.url)?.clone();},async put(req,res){store.set(req.url,res);}};}};
  const context=vm.createContext({self,caches,URL,fetch:()=>new Promise(resolve=>release=resolve)});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),context);
  const cacheName=vm.runInContext('CACHE',context);
  handlers.fetch({request:{method:'GET',url},waitUntil:p=>background=p,respondWith:p=>response=p});
  assert.equal(await(await response).text(),'active-version');assert.equal(opened,1);
  named.delete(cacheName);release(new Response('fresh-network'));await background;
  assert.equal(opened,1);assert.equal(named.has(cacheName),false);
  let intercepted=false;handlers.fetch({request:{method:'GET',url:origin+'.example/index.html'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});

for(const fault of ['open','match','put']){
  test(`successful uncached network response survives cache ${fault} failure`,async()=>{
    const handlers={},origin='http://cache-test.local';let background,response;
    const caches={open:async()=>{
      if(fault==='open')throw Error('synthetic cache unavailable');
      return {match:async()=>{if(fault==='match')throw Error('synthetic read failure');},put:async()=>{if(fault==='put')throw Error('synthetic quota exceeded');}};
    }};
    const self={location:{origin},addEventListener:(n,fn)=>handlers[n]=fn};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),{self,caches,URL,fetch:async()=>new Response('network success',{status:200,headers:{'X-Fixture':'network'}})});
    handlers.fetch({request:{method:'GET',url:origin+'/uncached.webp'},waitUntil:p=>background=p,respondWith:p=>response=p});
    const result=await response;assert.equal(result.status,200);assert.equal(await result.text(),'network success');assert.equal(result.headers.get('X-Fixture'),'network');await background;
  });
}

test('a pending cache write does not delay the network response',async()=>{
  const handlers={},origin='http://cache-test.local';let release,background,response,putStarted=false;
  const caches={open:async()=>({match:async()=>undefined,put:()=>{putStarted=true;return new Promise(resolve=>release=resolve);}})};
  const self={location:{origin},addEventListener:(n,fn)=>handlers[n]=fn};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),{self,caches,URL,fetch:async()=>new Response('independent network response')});
  handlers.fetch({request:{method:'GET',url:origin+'/uncached'},waitUntil:p=>background=p,respondWith:p=>response=p});
  const result=await response;assert.equal(await result.text(),'independent network response');assert(putStarted);release();await background;
});
