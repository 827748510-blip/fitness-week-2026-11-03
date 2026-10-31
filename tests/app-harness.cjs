const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const KEY = 'fitness-tracker-v2';
const OLD_KEY = 'fitness-week-2026-11-03';
const html = fs.readFileSync(process.env.FITNESS_TEST_HTML || path.join(__dirname, '../index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);

// No network implementation exists in this sandbox. All records and credentials
// are synthetic; even accidental fetches can only enter the request queue below.
function createApp({storage = new Map(), confirm = true, syncConfig = {enabled:true, endpoint:"/__test__/fitness-sync"}} = {}) {
  const elements = new Map();
  const timers = new Map();
  const requests = [];
  const listeners = new Map();
  let timerId = 0;
  let storageFails = false;
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      const el = {
        innerHTML: '', textContent: '', style: {}, isConnected:true,
        classList: {
          add: name => classes.add(name), remove: name => classes.delete(name),
          toggle(name, enabled) { if(enabled) classes.add(name); else classes.delete(name); },
          contains: name => classes.has(name)
        },
        focus() { sandbox.document.activeElement = el; }
      };
      elements.set(id, el);
    }
    return elements.get(id);
  }
  const sandbox = {
    console: {warn() {}},
    document: {
      getElementById: element,
      querySelectorAll() { return []; },
      addEventListener(type, handler) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(handler);
      },
      body: {style: {}}
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem(key, value) {
        if (storageFails) throw new Error('synthetic storage failure');
        storage.set(key, value);
      },
      removeItem: key => storage.delete(key)
    },
    confirm: () => confirm,
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    fetch(url, options) {
      return new Promise((resolve, reject) => requests.push({
        // Check only synthetic credentials, never echo source credentials.
        sameOriginSession: options.credentials === 'same-origin' && !options.headers.Authorization,
        redirect: options.redirect,
        syntheticUrl: url === 'http://127.0.0.1:18741/__test__/fitness-sync',
        method: options.method,
        contentType: options.headers['Content-Type'],
        payload: JSON.parse(options.body), resolve, reject
      }));
    },
    URL, navigator: {}, window: {FITNESS_SYNC_CONFIG:syncConfig, location:{href:"http://127.0.0.1:18741/"}, addEventListener() {}, scrollTo() {}}
  };
  element('tab-stats').hidden = true;
  const context = vm.createContext(sandbox);
  scripts.forEach(script => vm.runInContext(script, context));
  return {
    storage, requests, elements, timers,
    run: code => vm.runInContext(code, context),
    json: code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context)),
    failStorage: value => { storageFails = value; },
    element,
    activeElement: () => sandbox.document.activeElement,
    dispatch(type, event) {
      const value = {defaultPrevented:false, preventDefault() { this.defaultPrevented = true; }, ...event};
      for (const handler of listeners.get(type) || []) handler(value);
      return value;
    },
    tick() {
      const ready = [...timers.values()]; timers.clear();
      ready.forEach(callback => callback());
    },
    async settle(index, {status = 200, offline = false} = {}) {
      if (offline) requests[index].reject(new Error('synthetic offline'));
      else requests[index].resolve({ok: status >= 200 && status < 300, status});
      // Drain promise continuations, including any queued upload.
      await new Promise(resolve => setImmediate(resolve));
    }
  };
}

function seed(app) {
  app.run(`toggleDay('2026-11-03', true);
    setWeight('2026-11-03', '77.7');
    setActual('2026-11-03', 'a_legpress', '42');
    toggleCardio('2026-11-04', true);`);
}

module.exports = {createApp, seed, KEY, OLD_KEY};
