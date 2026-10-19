import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const chunks = [];
const registry = new Map();
const jsx = {Fragment: 'fragment', jsx: (type, props) => ({type, props}), jsxs: (type, props) => ({type, props})};
let environment;
const context = vm.createContext({
  TURBOPACK: {push: chunk => chunks.push(chunk)},
  URL, URLSearchParams, Headers, Response, AbortController, console,
  setTimeout: (...args) => environment.setTimeout(...args),
  clearTimeout: id => environment.clearTimeout(id),
  fetch: (...args) => environment.fetch(...args),
  window: {location: {pathname: '/'}},
  document: {addEventListener() {}, removeEventListener() {}, querySelector: () => null},
  localStorage: {getItem: () => null, setItem() {throw new Error('Storage unavailable');}, removeItem() {}}
});
for (const file of fs.readdirSync(path.join(dist, '_next/static/chunks')).filter(file => file.endsWith('.js'))) {
  const code = fs.readFileSync(path.join(dist, '_next/static/chunks', file), 'utf8');
  if (code.startsWith('(globalThis.TURBOPACK')) vm.runInContext(code, context);
}
for (const chunk of chunks) {
  let ids = [];
  for (const item of chunk.slice(1)) {
    if (typeof item === 'number') ids.push(item);
    else if (typeof item === 'function') {
      for (const id of ids) registry.set(id, item);
      ids = [];
    }
  }
}

function moduleLoader(overrides) {
  const cache = new Map();
  const commonJS = new Set();
  const imported = id => {
    const value = load(id);
    return commonJS.has(id) && !value.__esModule ? {...value, default: value} : value;
  };
  function load(id) {
    if (overrides.has(id)) return overrides.get(id);
    if (cache.has(id)) return cache.get(id);
    const exports = {};
    cache.set(id, exports);
    assert(registry.has(id), 'Missing compiled module ' + id);
    const module = {exports};
    const factory = registry.get(id);
    factory({i: imported, r: load, g: context, s: (values, target = id) => {
      const targetExports = cache.get(target) || {};
      cache.set(target, targetExports);
      for (let i = 0; i < values.length;) {
        const name = values[i++], value = values[i++];
        if (value === 0) targetExports[name] = values[i++];
        else Object.defineProperty(targetExports, name, {get: value, configurable: true});
      }
    }}, module, exports);
    if (factory.length > 1) {cache.set(id, module.exports); commonJS.add(id);}
    return cache.get(id);
  }
  return load;
}

function createHarness() {
  let now = 0, nextId = 1, cursor = 0, dirty = false, output, props;
  const hooks = [], pendingEffects = [], timers = new Map(), errors = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = {value: typeof initial === 'function' ? initial() : initial};
      return [hooks[index].value, value => {
        hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value;
        dirty = true;
      }];
    },
    useRef(initial) {const index = cursor++; return hooks[index] ||= {current: initial};},
    useEffect(effect, deps) {
      const index = cursor++, previous = hooks[index];
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
        pendingEffects.push(() => {previous?.cleanup?.(); hooks[index] = {deps, cleanup: effect()};});
      }
    }
  };
  const listeners = new Map();
  environment = {
    setTimeout(callback, delay) {const id = nextId++; timers.set(id, {callback, time: now + delay}); return id;},
    clearTimeout: id => timers.delete(id),
    // Missing optional animation must never keep the page covered.
    fetch: () => new Promise(() => {})
  };
  context.window.addEventListener = (type, fn) => listeners.set(type, fn);
  context.window.removeEventListener = type => listeners.delete(type);
  const Component = moduleLoader(new Map([[71645, react], [43476, jsx], [69345, {default: 'animation'}]]))(55583).default;
  function render(nextProps = props) {
    props = nextProps; cursor = 0; dirty = false;
    output = Component(props);
    while (pendingEffects.length) {
      try {pendingEffects.shift()();} catch (error) {errors.push(error);}
    }
    if (dirty) render();
    return output;
  }
  return {
    render, errors,
    advance(duration) {
      const end = now + duration;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].time - b[1].time)[0];
        if (!next || next[1].time > end) break;
        now = next[1].time; timers.delete(next[0]);
        try {next[1].callback();} catch (error) {errors.push(error);}
        if (dirty) render();
      }
      now = end;
      return output;
    },
    unmount() {for (const hook of hooks) hook?.cleanup?.();}
  };
}

for (const route of ['/ar/', '/en/', '/ar/services/', '/en/services/']) {
  context.window.location.pathname = route;
  const html = fs.readFileSync(path.join(dist, route.slice(1), 'index.html'), 'utf8');
  // Every affected page must load the repaired shared screen, including refreshes.
  assert([...html.matchAll(/src="([^" ]+\.js)"/g)].some(match => {
    const file = path.join(dist, match[1]);
    return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('saifi-loading-screen');
  }), route + ': repaired chunk is missing');
  const servicesRoute = /^\/(?:ar|en)\/services\/?$/.test(route);
  assert.equal(html.includes('id="saifi-services-no-loader"'), servicesRoute, route + ': loader visibility style mismatch');
  const harness = createHarness();
  let firstCallback = 0, latestCallback = 0;
  const content = {route};
  const firstFrame = harness.render({onLoadingComplete: () => firstCallback++, children: content});
  if (servicesRoute) {
    assert.equal(firstFrame.props.children, content, route + ': services must render immediately without loader');
    assert.equal(firstCallback, 1, route + ': services completion callback must run immediately');
    assert.equal(harness.advance(10000).props.children, content, route + ': services content must remain visible');
    harness.unmount();
    continue;
  }
  assert.equal(firstFrame.props.className, 'fixed inset-0 z-9999 flex items-center justify-center bg-black');
  assert(JSON.stringify(firstFrame).includes('/assets/brand/saifi-wallet-white.svg'));
  harness.advance(400);
  harness.render({onLoadingComplete: () => latestCallback++, children: content});
  const completedFrame = harness.advance(200);
  assert.equal(harness.errors.length, 0, route + ': optional storage must not throw');
  assert.equal(firstCallback, 0);
  assert.equal(latestCallback, 1, route + ': callback changes must not restart the loading deadline');
  assert.equal(completedFrame.props.children, content);
  harness.advance(10000);
  assert.equal(latestCallback, 1, route + ': completion must run once');
  harness.unmount();
}
const unmounted = createHarness();
let lateCallback = 0;
context.window.location.pathname = '/ar/';
unmounted.render({onLoadingComplete: () => lateCallback++, children: null, isLanguageChange: true});
unmounted.unmount();
unmounted.advance(1000);
assert.equal(lateCallback, 0, 'Unmounted language screen must clear its timer');

// Exercise the retained client's actual API and page transformation with the local adapter.
environment = {setTimeout, clearTimeout, fetch: (...args) => context.window.fetch(...args)};
context.location = {origin: 'https://test.local', pathname: '/ar/', assign() {}};
context.window.fetch = async () => {throw new Error('Unexpected external content request');};
context.document.body = {append() {}};
vm.runInContext(fs.readFileSync(path.join(dist, '_rebuild/data.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(dist, '_rebuild/runtime.js'), 'utf8'), context);
const load = moduleLoader(new Map([
  [71645, {createContext: () => ({})}], [43476, jsx], [47167, {default: {env: {}}}],
  // These UI hooks and font initializers are outside the exercised data pipeline.
  [59620, {}], [18566, {}], [16575, {}], [13212, {}], [29031, {}]
]));
const api = load(3277).api;
for (const locale of ['ar', 'en']) {
  context.location.pathname = '/' + locale + '/';
  const home = await load(78537).fetchPageDataByPath('/' + locale + '/', locale);
  assert(home.mainServices.length > 0, locale + ': homepage service cards');
  assert(home.faqData.faq.length > 0, locale + ': homepage FAQs');
  assert(home.valueCardGridData.valueData.length > 0, locale + ': homepage statistics');
  const services = await api.getPageSections(3);
  assert.equal(services.success, true);
  assert(services.data.some(section => section.contents?.length > 0), locale + ': service content');
}
const reportPath = path.join(root, 'verification-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
report.loadingChecks = {passed: true, routes: ['/ar/', '/en/', '/ar/services/', '/en/services/'], servicesLoader: 'hidden before first paint and removed immediately on mount', otherRoutesIntroMilliseconds: 600, unavailableStorage: true, missingAnimation: true, callbackUpdates: true, unmountCleanup: true, compiledContentPipeline: true};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log('Passed: services routes render without the loader; other routes retain their 600 ms intro; callback, unmount, blocked storage, missing media, and compiled content checks passed. Browser rendering remains unverified.');
