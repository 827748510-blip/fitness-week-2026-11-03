// Run with playwright-cli run-code --filename tests/browser-smoke.js.
// Serve this checkout at http://127.0.0.1:18741 first. Every external request
// is intercepted before navigation; only synthetic records are entered.
async (page) => {
  const context = await page.context().browser().newContext({
    serviceWorkers: 'block', viewport: {width:390, height:844}, hasTouch:true,
    timezoneId: 'America/Los_Angeles'
  });
  const testPage = await context.newPage();
  const requests = [];
  const errors = [];
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const isEmpty = state => Object.values(state.days).every(day =>
    !day.done && day.weight === '' && !day.cardioDone &&
    Object.values(day.exercises).every(ex => !ex.done && ex.actual === ''));
  let nextMode = 'success';
  let release;
  let remoteState;
  testPage.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === 'http://127.0.0.1:18741' && req.method() === 'GET') {
      return route.continue();
    }
    if (url.hostname === 'api.jstash.app' && req.method() === 'PUT') {
      const payload = req.postDataJSON();
      requests.push(payload);
      const mode = nextMode; nextMode = 'success';
      if (mode === 'hold') await new Promise(resolve => { release = resolve; });
      if (mode === 'fail') return route.fulfill({status:503, body:'synthetic failure'});
      remoteState = payload.state;
      return route.fulfill({status:200, contentType:'application/json', body:'{}'});
    }
    return route.abort();
  });
  const waitStatus = text => testPage.locator('#syncHint').filter({hasText:text}).waitFor();
  const reset = async () => {
    testPage.once('dialog', dialog => dialog.accept());
    await testPage.getByRole('button', {name:'清空本周记录', exact:true}).click();
  };
  const testLightbox = async size => {
    const img = testPage.locator('#days .meal img.zoomable').first();
    for (const key of ['Enter', 'Space']) {
      await img.scrollIntoViewIfNeeded(); await img.focus();
      const y = await testPage.evaluate(() => scrollY);
      await testPage.keyboard.press(key);
      await testPage.locator('#lightbox.open').waitFor();
      check(await testPage.evaluate(() => document.activeElement.id === 'lightboxClose'), 'dialog focus');
      check(await testPage.evaluate(() => scrollY) === y, 'activation does not scroll');
      for (const tab of ['Tab','Shift+Tab']) {
        await testPage.keyboard.press(tab);
        check(await testPage.evaluate(() => document.activeElement.id === 'lightboxClose'), 'dialog contains keyboard focus');
      }
      await testPage.screenshot({path:`output/playwright/${size}-lightbox.png`});
      await testPage.keyboard.press('Escape');
      check(await img.evaluate(el => document.activeElement === el), 'Escape restores trigger focus');
    }
    await img.click();
    await testPage.getByRole('button', {name:'关闭图片预览',exact:true}).click();
    check(await img.evaluate(el => document.activeElement === el), 'mouse close restores focus');
    await img.tap();
    await testPage.getByRole('button', {name:'关闭图片预览',exact:true}).tap();
    check(await img.evaluate(el => document.activeElement === el), 'touch close restores focus');
  };
  try {
    await testPage.goto('http://127.0.0.1:18741/');
    await testPage.getByRole('heading', {name:'健身周计划', exact:true}).waitFor();
    check(requests.length === 0, 'fresh visit must not upload');
    const expected = ['11-03 周二','11-04 周三','11-05 周四','11-06 周五','11-07 周六','11-08 周日','11-09 周一'];
    check(JSON.stringify(await testPage.locator('.ov-date').allTextContents()) === JSON.stringify(expected), 'seven browser calendar labels');
    check(await testPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile overflow');
    await testLightbox('mobile');
    await testPage.evaluate(() => {
      state.weeks['2026-10-27'] = {days:{'2026-10-27':{done:true,weight:'88.8'}}};
      state.weightLog.push({date:'2026-10-27',kg:88.8});
      state.liftLog.push({date:'2026-10-27',exerciseId:'a_legpress',name:'synthetic history',kg:50});
      save();
    });
    await testPage.locator('.ov-weight input').first().fill('77.7');
    await testPage.locator('.ov-check input').first().check();
    await waitStatus('已上传给教练');
    check(remoteState.days['2026-11-03'].weight === '77.7', 'synthetic initial sync');
    const actual = testPage.locator('#day-2026-11-03 .ex[data-ex="a_legpress"] input[type="text"]');
    for (const [text, kg] of [['50kg × 12',null], ['12.5 公斤',12.5], ['40–50kg',null]]) {
      await actual.fill(text); await waitStatus('已上传给教练');
      check(remoteState.days['2026-11-03'].exercises.a_legpress.actual === text, 'original actual text preserved');
      const log = remoteState.liftLog.find(entry => entry.date === '2026-11-03' && entry.exerciseId === 'a_legpress');
      check(kg === null ? !log : log && log.kg === kg, 'strict weight statistic');
    }
    await testPage.getByText('同步、备份与安装', {exact:true}).click();

    await reset(); await waitStatus('已上传给教练');
    check(isEmpty(remoteState), 'successful reset must replace remote mock data');
    check(await testPage.locator('.ov-weight input').first().inputValue() === '', 'weight UI cleared');
    check(!await testPage.locator('.ov-check input').first().isChecked(), 'checkbox UI cleared');
    check(await testPage.locator('#progressText').textContent() === '本周完成 0/7 天', 'progress cleared');

    await testPage.locator('.ov-weight input').first().fill('66.6');
    await waitStatus('已上传给教练');
    nextMode = 'fail'; await reset(); await waitStatus('同步失败');
    check(await testPage.evaluate(() => JSON.parse(localStorage.getItem('fitness-tracker-v2')).days['2026-11-03'].weight === ''), 'failed reset stays empty locally');
    await testPage.getByRole('button', {name:'立即同步', exact:true}).first().click();
    await waitStatus('已上传给教练'); check(isEmpty(remoteState), 'manual retry');

    await testPage.locator('.ov-weight input').first().fill('55.5'); await waitStatus('已上传给教练');
    nextMode = 'fail'; await reset(); await waitStatus('同步失败');
    await testPage.reload(); await waitStatus('已上传给教练');
    check(isEmpty(remoteState), 'reload retries saved reset');
    await testPage.getByText('同步、备份与安装', {exact:true}).click();

    nextMode = 'hold';
    await testPage.locator('.ov-weight input').first().fill('44.4');
    await waitStatus('上传中');
    await testPage.waitForFunction(() => document.querySelector('#syncHint').textContent.includes('上传中'));
    // Poll for the intercepted request without relying on arbitrary network delays.
    for (let i = 0; !release && i < 100; i++) await testPage.waitForTimeout(20);
    check(!!release, 'old upload intercepted');
    const before = requests.length;
    await reset(); await waitStatus('等待');
    check(requests.length === before, 'reset must not overtake pending PUT');
    release(); release = undefined;
    await waitStatus('已上传给教练');
    check(requests.length === before + 1 && isEmpty(remoteState), 'empty snapshot follows old PUT');
    await testPage.screenshot({path:'output/playwright/mobile-reset.png'});
    await testPage.setViewportSize({width:1440, height:1000});
    check(await testPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'desktop overflow');
    await testPage.screenshot({path:'output/playwright/desktop-reset.png'});
    await testLightbox('desktop');
    check(remoteState.weightLog.length === 1 && remoteState.weightLog[0].date === '2026-10-27', 'historical weight preserved');
    check(remoteState.liftLog.length === 1 && remoteState.weeks['2026-10-27'].days['2026-10-27'].done, 'historical lifts and archive preserved');
    await testPage.getByRole('button', {name:'统计', exact:true}).click();
    check((await testPage.locator('#completionBox').textContent()).includes('本周 0/7'), 'stats refresh after reset');
    check(await testPage.locator('#weightStatText').textContent() === '当前 88.8 kg', 'stats retain historical weight');
    await testPage.screenshot({path:'output/playwright/stats-after-reset.png'});
    check(errors.length === 0, 'no browser runtime errors');
    await page.evaluate(report => { globalThis.fitnessSmokeReport = report; }, {
      result:'PASS', mockUploads:requests.length, labels:expected,
      checks:['mobile and desktop','reset success','failure and manual retry','reload retry','serialized in-flight reset','historical records preserved','stats refresh','strict weight parsing','keyboard and focus','mouse and touch','no runtime errors'],
      externalRequestsAllowed:0
    });
  } finally {
    if (release) release();
    await context.close();
  }
}
