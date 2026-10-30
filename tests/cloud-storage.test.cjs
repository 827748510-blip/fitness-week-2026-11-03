const assert=require('node:assert/strict');
const {test}=require('node:test');
const {createApp,KEY}=require('./app-harness.cjs');

test('failed set confirmation preserves memory, storage, and the upload queue',()=>{
  const app=createApp();
  const before=app.json('state');
  app.failStorage(true);
  assert.throws(()=>app.run("saveExerciseSet('2026-11-03','a_row','19kg',true)"));
  assert.deepEqual(app.json('state'),before);
  assert.equal(app.storage.has(KEY),false);
  assert.equal(app.requests.length,0);
  assert.equal(app.timers.size,0);
});

test('final set saves weight and confirmation in one complete original-schema snapshot',async()=>{
  const app=createApp();app.run('document.querySelector=()=>null');
  app.run("saveExerciseSet('2026-11-03','a_row','19kg',true)");
  const stored=JSON.parse(app.storage.get(KEY));
  assert.equal(stored.days['2026-11-03'].exercises.a_row.done,true);
  assert.equal(stored.days['2026-11-03'].exercises.a_row.actual,'19kg');
  assert.equal(stored.liftLog[0].kg,19);
  assert.equal(stored.days['2026-11-03'].done,false);
  app.tick();assert.equal(app.requests.length,1);
  assert.deepEqual(app.requests[0].payload.state,stored);
  assert.equal(app.requests[0].syntheticAuth,true);
  assert.equal(app.requests[0].syntheticUrl,true);
  await app.settle(0);
});

test('failed undo leaves the saved final set confirmed and queues no second upload',async()=>{
  const app=createApp();app.run('document.querySelector=()=>null');
  app.run("saveExerciseSet('2026-11-03','a_row','19kg',true)");app.tick();await app.settle(0);
  const before=app.storage.get(KEY);app.failStorage(true);
  assert.throws(()=>app.run("saveExerciseSet('2026-11-03','a_row',null,false)"));
  assert.equal(app.storage.get(KEY),before);
  assert.deepEqual(app.json('state'),JSON.parse(before));
  assert.equal(app.requests.length,1);assert.equal(app.timers.size,0);
});
