const assert = require('node:assert/strict');
const {test} = require('node:test');
const {execFileSync} = require('node:child_process');
const {createApp, seed, KEY, OLD_KEY} = require('./app-harness.cjs');

function assertEmpty(app, state) {
  assert.deepEqual(state, app.json('({...defaultState(), weeks:{[WEEK_KEY]:{days:defaultState().days}}})'));
}

test('reset after a completed upload persists and uploads a full empty snapshot with the existing protocol', async () => {
  const app = createApp(); seed(app); app.tick(); await app.settle(0);
  assert.equal(app.timers.size, 0);
  app.run('resetData()');
  assertEmpty(app, JSON.parse(app.storage.get(KEY)));
  assert.equal(app.requests.length, 2);
  const request = app.requests[1];
  assert.equal(request.sameOriginSession, true);
  assert.equal(request.syntheticUrl, true);
  assert.equal(request.method, 'PUT');
  assert.equal(request.contentType, 'application/json');
  assert.equal(request.payload.key, KEY);
  assert.equal(request.payload.week, '2026-11-03 to 2026-11-09');
  assert.equal(request.payload.source, 'pwa');
  assert.equal(request.payload.schemaVersion, 2);
  assert.equal(request.payload.weekKey, '2026-11-03');
  assert.ok(Number.isFinite(Date.parse(request.payload.updated_at)));
  assertEmpty(app, request.payload.state);
  assert.match(app.elements.get('saveHint').textContent, /本机已清空/);
  assert.equal(app.elements.get('progressText').textContent, '本周完成 0/7 天');
  await app.settle(1);
  assert.match(app.elements.get('syncHint').textContent, /已上传给教练/);
});

test('cancel leaves records, storage, timers and requests untouched', () => {
  const app = createApp({confirm:false}); seed(app);
  const before = app.storage.get(KEY);
  app.run('resetData()');
  assert.equal(app.storage.get(KEY), before);
  assert.equal(app.requests.length, 0);
  assert.equal(app.timers.size, 1);
});

test('reset cancels an older debounce so only empty data uploads', () => {
  const app = createApp(); seed(app);
  app.run('resetData()'); app.tick();
  assert.equal(app.requests.length, 1);
  assertEmpty(app, app.requests[0].payload.state);
});

for (const failure of [{offline:true}, {status:401}, {status:503}]) {
  test(`failed reset upload is explicit and manual retry sends the saved empty state (${JSON.stringify(failure)})`, async () => {
    const app = createApp(); seed(app); app.run('resetData()');
    await app.settle(0, failure);
    assert.match(app.elements.get('syncHint').textContent, /同步失败.*立即同步.*重试/);
    assertEmpty(app, JSON.parse(app.storage.get(KEY)));
    app.run('syncNow()');
    assertEmpty(app, app.requests[1].payload.state);
    await app.settle(1);
    assert.match(app.elements.get('syncHint').textContent, /已上传给教练/);
  });
}

test('reopening after an offline reset retries empty data, without resurrecting old records', async () => {
  const app = createApp(); seed(app); app.run('resetData()');
  await app.settle(0, {offline:true});
  const reopened = createApp({storage:app.storage});
  assertEmpty(reopened, reopened.json('state'));
  reopened.tick();
  assert.equal(reopened.requests.length, 1);
  assertEmpty(reopened, reopened.requests[0].payload.state);
  await reopened.settle(0);
  assert.match(reopened.elements.get('syncHint').textContent, /已上传给教练/);
});

for (const failure of [null, {offline:true}, {status:500}]) {
  test(`an in-flight old upload finishes before the reset snapshot is sent (${JSON.stringify(failure)})`, async () => {
    const app = createApp(); seed(app); app.tick();
    assert.equal(app.requests[0].payload.state.days['2026-11-03'].done, true);
    app.run('resetData(); syncNow();'); app.tick();
    assert.equal(app.requests.length, 1, 'no concurrent PUT may overtake the old upload');
    assert.match(app.elements.get('syncHint').textContent, /等待/);
    await app.settle(0, failure || {});
    assert.equal(app.requests.length, 2);
    assertEmpty(app, app.requests[1].payload.state);
    assert.doesNotMatch(app.elements.get('syncHint').textContent, /已上传/);
    await app.settle(1);
    assert.match(app.elements.get('syncHint').textContent, /已上传给教练/);
    assertEmpty(app, app.requests.at(-1).payload.state);
  });
}

test('edits during reset upload are serialized and the newest snapshot wins', async () => {
  const app = createApp(); app.run('resetData()');
  app.run(`setWeight('2026-11-03', '66.6')`);
  assert.equal(app.requests.length, 1);
  assertEmpty(app, app.requests[0].payload.state);
  await app.settle(0);
  assert.equal(app.requests.length, 2);
  assert.equal(app.requests[1].payload.state.days['2026-11-03'].weight, '66.6');
  await app.settle(1);
  assert.deepEqual(app.requests[1].payload.state, JSON.parse(app.storage.get(KEY)));
});

test('storage failure preserves original records and sends no reset', () => {
  const app = createApp(); seed(app);
  const before = app.storage.get(KEY);
  app.failStorage(true); app.run('resetData()');
  assert.equal(app.storage.get(KEY), before);
  assert.deepEqual(app.json('state'), JSON.parse(before));
  assert.equal(app.requests.length, 0);
  assert.match(app.elements.get('saveHint').textContent, /清空失败.*原记录保留/);
});

test('an empty first visit does not upload until the user makes a change', () => {
  const app = createApp(); app.tick();
  assert.equal(app.requests.length, 0);
  app.run('resetData()');
  assert.equal(app.requests.length, 1);
  assertEmpty(app, app.requests[0].payload.state);
});

test('reset preserves other weeks and historical logs in storage and upload', () => {
  const app = createApp(); seed(app);
  app.run(`state.weeks['2026-10-27'] = {days:{'2026-10-27':{done:true,weight:'88.8'}}};
    state.weightLog.push({date:'2026-10-27',kg:88.8});
    state.liftLog.push({date:'2026-10-27',exerciseId:'a_legpress',name:'synthetic',kg:50});
    save(); switchTab('stats'); resetData();`);
  const saved = JSON.parse(app.storage.get(KEY));
  assert.deepEqual(saved.days, app.json('defaultState().days'));
  assert.deepEqual(saved.weeks['2026-11-03'].days, saved.days);
  assert.equal(saved.weeks['2026-10-27'].days['2026-10-27'].weight, '88.8');
  assert.deepEqual(saved.weightLog, [{date:'2026-10-27',kg:88.8}]);
  assert.deepEqual(saved.liftLog, [{date:'2026-10-27',exerciseId:'a_legpress',name:'synthetic',kg:50}]);
  assert.deepEqual(app.requests[0].payload.state, saved);
  assert.match(app.elements.get('completionBox').innerHTML, /本周 0\/7/);
  assert.equal(app.elements.get('weightStatText').textContent, '当前 88.8 kg');
});

test('legacy migration followed by reset reopens the v2 cleared snapshot', async () => {
  const fixture = createApp(); seed(fixture);
  const legacy = JSON.stringify({days:fixture.json('state.days')});
  const storage = new Map([[OLD_KEY, legacy]]);
  const app = createApp({storage});
  assert.equal(app.json('state.weightLog').length, 1);
  app.run('resetData()'); await app.settle(0);
  assert.equal(storage.get(OLD_KEY), legacy, 'migration source is preserved');
  const reopened = createApp({storage}); reopened.tick();
  assertEmpty(reopened, reopened.requests[0].payload.state);
});

test('all seven overview and detail labels match calendar dates', () => {
  const app = createApp();
  const expected = ['二', '三', '四', '五', '六', '日', '一'];
  assert.deepEqual(app.json('days.map(day => day.dow)'), expected);
  expected.forEach((dow, index) => {
    const day = `2026-11-${String(index + 3).padStart(2, '0')}`;
    assert.ok(app.elements.get('overviewList').innerHTML.includes(`${day.slice(5)} 周${dow}`));
    assert.ok(app.elements.get('days').innerHTML.includes(`${day} 周${dow}`));
  });
});

test('weekdays are identical across UTC, Shanghai, DST and extreme timezone offsets', () => {
  for (const TZ of ['UTC', 'Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Honolulu']) {
    const output = execFileSync(process.execPath, ['-e', `
      const {createApp} = require(${JSON.stringify(require.resolve('./app-harness.cjs'))});
      process.stdout.write(JSON.stringify(createApp().json('days.map(day => day.dow)')));
    `], {env:{...process.env, TZ}, encoding:'utf8'});
    assert.deepEqual(JSON.parse(output), ['二', '三', '四', '五', '六', '日', '一'], TZ);
  }
});
