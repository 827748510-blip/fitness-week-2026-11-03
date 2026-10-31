const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createApp,seed,KEY}=require('./app-harness.cjs');

test('shipped config is explicitly disabled and fresh/reopened/manual edits never upload',()=>{
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sync-config.js'),'utf8'),context);
  assert.equal(context.window.FITNESS_SYNC_CONFIG.enabled,false);
  assert.equal(context.window.FITNESS_SYNC_CONFIG.endpoint,null);
  const app=createApp({syncConfig:context.window.FITNESS_SYNC_CONFIG});
  seed(app);app.tick();app.run('syncNow()');app.tick();
  assert(app.storage.has(KEY));assert.equal(app.requests.length,0);assert.equal(app.timers.size,0);
  assert.match(app.element('syncHint').textContent,/同步未启用.*本机.*备份/);
  assert.doesNotMatch(app.element('syncHint').textContent,/就绪|上传中|已上传/);
  const reopened=createApp({storage:app.storage,syncConfig:context.window.FITNESS_SYNC_CONFIG});
  reopened.tick();assert.equal(reopened.requests.length,0);
});

for(const config of [null,{}, {enabled:true},
  {enabled:true,endpoint:'https://sync.invalid/bin'},
  {enabled:true,endpoint:'/placeholder'},
  {enabled:true,endpoint:'https://other.example/api/fitness-sync'},
  {enabled:true,endpoint:'http://user:secret@127.0.0.1:18741/api/fitness-sync'},
  {enabled:true,endpoint:'/api/fitness-sync?token=synthetic'},
  {enabled:true,endpoint:'/api/fitness-sync#token'},
  {enabled:true,endpoint:'/api/fitness-sync',editToken:'synthetic'},
  {enabled:true,endpoint:'/api/fitness-sync',headers:{Authorization:'synthetic'}}]){
  test('missing, placeholder, cross-origin or secret-bearing config fails closed: '+JSON.stringify(config),()=>{
    const app=createApp({syncConfig:config});seed(app);app.run('syncNow()');app.tick();
    assert.equal(app.json('SYNC.enabled'),false);assert.equal(app.requests.length,0);assert.equal(app.timers.size,0);
  });
}

test('accepted configuration uses same-origin session credentials, rejects redirects and sends no service token',async()=>{
  const app=createApp();seed(app);app.tick();const request=app.requests[0];
  assert(request.sameOriginSession&&request.syntheticUrl);assert.equal(request.redirect,'error');
  assert.equal(app.json('Object.isFrozen(SYNC)'),true);
  assert.equal(app.run('validateSyncConfig({enabled:true,endpoint:"/api/fitness-sync"},"http://public.example/").enabled'),false);
  await app.settle(0);
});

test('local recovery identity is preserved on load and omitted from remote payload',()=>{
  const app=createApp();seed(app);app.run('state.workbenchCommit="local-transaction-123";save();');
  const reopened=createApp({storage:app.storage});
  assert.equal(reopened.json('state.workbenchCommit'),'local-transaction-123');
  assert.equal(reopened.json('Object.hasOwn(buildPayload().state,"workbenchCommit")'),false);
});
