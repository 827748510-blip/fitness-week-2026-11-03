const assert = require('node:assert/strict');
const {test} = require('node:test');
const {createApp, KEY, OLD_KEY} = require('./app-harness.cjs');

test('weight statistics accept only a single finite nonnegative decimal with an optional kg unit', () => {
  const app = createApp();
  for (const [input, expected] of [[50,50],[0,0],['0',0],['50',50],[' 50kg ',50],
    ['50 KG',50],['50 公斤',50],['50千克',50],['12.50 kg',12.5],['.5',0.5],['0.25公斤',0.25]]) {
    assert.equal(app.run(`parseNumKg(${JSON.stringify(input)})`), expected, String(input));
  }
});

test('ranges, repetitions, signs, multiple numbers, unsupported units and free text are not concatenated into kg', () => {
  const app = createApp();
  for (const input of ['50kg × 12','50kgx12','50kg*12','3×12@50kg','40–50kg','40-50kg',
    '40~50kg','40至50公斤','50/60','5 0','-50','−50kg','+50','1.2.3','50.','1,000kg',
    '1e3','0x10','50lb','约50kg','重量50','50kg（轻松）','n/a','',null,true,{},[50],[50,12],'Infinity','NaN','9'.repeat(400)]) {
    assert.equal(app.run(`parseNumKg(${JSON.stringify(input)})`), null, String(input));
  }
});

test('new free-text actuals remain verbatim in records while ambiguous values stay out of lift statistics', () => {
  const app = createApp();
  app.run(`setActual('2026-11-03', 'a_legpress', '50kg');`);
  assert.equal(app.json('state.liftLog')[0].kg, 50);
  for (const actual of ['50kg × 12','40–50kg','-10kg','n/a']) {
    app.run(`setActual('2026-11-03', 'a_legpress', ${JSON.stringify(actual)});`);
    const stored = JSON.parse(app.storage.get(KEY));
    assert.equal(stored.days['2026-11-03'].exercises.a_legpress.actual, actual);
    assert.equal(stored.liftLog.length, 0);
  }
  app.run(`setActual('2026-11-03', 'a_legpress', '12.5 公斤');`);
  assert.equal(app.json('state.liftLog')[0].kg, 12.5);
});

test('legacy migration preserves all original text and derives statistics only from unambiguous weights', () => {
  const fixture = createApp().json('defaultState()');
  const values = {a_legpress:'50kg × 12',a_chest:'40–50kg',a_row:'50kg',a_legcurl:'-5kg',a_arms:'12.5公斤',a_crunch:'.5',a_cardio:'n/a'};
  for (const [id, actual] of Object.entries(values)) fixture.days['2026-11-03'].exercises[id].actual = actual;
  fixture.days['2026-11-03'].weight = '77.7kg';
  fixture.days['2026-11-04'].weight = '70–80';
  const legacy = JSON.stringify({days:fixture.days});
  const storage = new Map([[OLD_KEY, legacy]]);
  const app = createApp({storage});
  assert.equal(storage.get(OLD_KEY), legacy);
  for (const [id, actual] of Object.entries(values)) assert.equal(app.json('state.days')['2026-11-03'].exercises[id].actual, actual);
  assert.deepEqual(app.json('state.liftLog.map(({exerciseId,kg}) => ({exerciseId,kg}))'), [
    {exerciseId:'a_row',kg:50},{exerciseId:'a_arms',kg:12.5},{exerciseId:'a_crunch',kg:0.5}
  ]);
  assert.deepEqual(app.json('state.weightLog'), [{date:'2026-11-03',kg:77.7}]);
});

test('loading existing v2 records never rewrites historical numeric logs or original actuals', () => {
  const fixture = createApp().json('defaultState()');
  fixture.weeks['2026-11-03'] = {days:fixture.days};
  fixture.days['2026-11-03'].exercises.a_legpress.actual = '50kg × 12';
  fixture.liftLog = [{date:'2026-11-03',exerciseId:'a_legpress',name:'existing synthetic record',kg:5012}];
  const original = JSON.stringify(fixture);
  const storage = new Map([[KEY,original]]);
  const app = createApp({storage});
  assert.equal(storage.get(KEY), original);
  assert.deepEqual(app.json('state.liftLog'), fixture.liftLog);
  assert.equal(app.json('state.days')['2026-11-03'].exercises.a_legpress.actual, '50kg × 12');
});

function imageFixture(app) {
  const img = app.element('synthetic-image');
  img.src = 'http://test.invalid/synthetic.jpg'; img.alt = 'synthetic';
  img.closest = selector => selector === '#days img.zoomable' ? img : null;
  img.focus();
  return img;
}

for (const key of ['Enter', ' ']) {
  test(`${JSON.stringify(key)} opens the lightbox without default scrolling and Escape restores focus`, () => {
    const app = createApp(); const img = imageFixture(app);
    app.run('document.body.style.overflow = "auto"');
    assert.equal(app.dispatch('keydown', {key,target:img}).defaultPrevented, true);
    assert.equal(app.element('lightbox').classList.contains('open'), true);
    assert.equal(app.activeElement(), app.element('lightboxClose'));
    assert.equal(app.run('document.body.style.overflow'), 'hidden');
    for (const shiftKey of [false,true]) {
      assert.equal(app.dispatch('keydown', {key:'Tab',shiftKey,target:app.element('lightboxClose')}).defaultPrevented, true);
      assert.equal(app.activeElement(), app.element('lightboxClose'));
    }
    app.dispatch('keydown', {key:'Escape',target:app.element('lightboxClose')});
    assert.equal(app.element('lightbox').classList.contains('open'), false);
    assert.equal(app.activeElement(), img);
    assert.equal(app.run('document.body.style.overflow'), 'auto');
  });
}

test('mouse/touch click behavior remains available and repeated keys or unrelated inputs do not activate images', () => {
  const app = createApp(); const img = imageFixture(app);
  app.dispatch('keydown', {key:'Enter',repeat:true,target:img});
  assert.equal(app.element('lightbox').classList.contains('open'), false);
  const other = {closest:() => null};
  assert.equal(app.dispatch('keydown', {key:' ',target:other}).defaultPrevented, false);
  app.dispatch('click', {target:img});
  assert.equal(app.element('lightbox').classList.contains('open'), true);
  app.dispatch('click', {target:{closest:selector => selector === '#lightbox' ? app.element('lightbox') : null}});
  assert.equal(app.element('lightbox').classList.contains('open'), false);
  assert.equal(app.activeElement(), img);
});
