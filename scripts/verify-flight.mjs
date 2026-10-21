import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {flightPayload, parseFlight, repairFlightTextLengths, repairRouteFlight} from '../src/flight-stream.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const routes = JSON.parse(fs.readFileSync(path.join(root, 'vendor/routes.json'), 'utf8'));
const heroVideoChunk = fs.readFileSync(path.join(dist, '_next/static/chunks/0dcbocta2m4jy.js'), 'utf8');
assert(heroVideoChunk.includes('src:e.video.src,type:"video/mp4"'), 'Hero source must match the MP4 video content');

// Execute the shipped React Flight decoder, so this check is independent of
// our byte-length validator. Client components are references, not rendered UI.
const chunks = [];
const context = vm.createContext({
  TURBOPACK: {push: chunk => chunks.push(chunk)},
  TextDecoder, TextEncoder, ReadableStream, console
});
for (const name of fs.readdirSync(path.join(dist, '_next/static/chunks')).filter(name => name.endsWith('.js'))) {
  const code = fs.readFileSync(path.join(dist, '_next/static/chunks', name), 'utf8');
  if (code.startsWith('(globalThis.TURBOPACK')) vm.runInContext(code, context);
}
const registry = new Map();
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
assert(registry.has(64893), 'Missing shipped Flight decoder');

async function decodeWholePage(stream, parsed, fragmentSize = 257) {
  const modules = new Map();
  for (const [, [id, , name, async]] of parsed.imports) {
    let exports = modules.get(id);
    if (!exports) modules.set(id, exports = {__esModule: true});
    exports[name] = function ClientReference() {};
    if (async) {exports.then = undefined;}
  }
  const exports = {}, module = {exports};
  registry.get(64893)({
    r: id => {
      if (id === 74080) return {__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {d: new Proxy({}, {get: () => () => {}})}};
      assert(modules.has(id), 'Missing client reference ' + id);
      return modules.get(id);
    },
    L: file => {
      assert(fs.existsSync(path.join(dist, file)), 'Missing decoded chunk: ' + file);
      return Promise.resolve();
    }
  }, module, exports);
  const bytes = new TextEncoder().encode(stream);
  const input = new ReadableStream({start(controller) {
    for (let offset = 0; offset < bytes.length; offset += fragmentSize) controller.enqueue(bytes.subarray(offset, offset + fragmentSize));
    controller.close();
  }});
  const decoded = await exports.createFromReadableStream(input, {});
  let values = 0;
  const seen = new Set(), strings = [], elements = [];
  async function visit(value) {
    if (typeof value === 'string') {strings.push(value); return;}
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value); values++;
    if (typeof value.then === 'function') {await visit(await value); return;}
    if (value.$$typeof === Symbol.for('react.lazy')) {
      let resolved;
      try {resolved = value._init(value._payload);}
      catch (pending) {
        if (typeof pending?.then !== 'function') throw pending;
        await pending;
        resolved = value._init(value._payload);
      }
      await visit(resolved);
      return;
    }
    if (value.$$typeof === Symbol.for('react.transitional.element')) elements.push(value);
    for (const item of Object.values(value)) await visit(item);
  }
  await visit(decoded);
  assert(values > 30, 'Expected the complete page model');
  return {decoded, strings, elements};
}

// A real byte-length regression: Arabic is multi-byte, with a later record
// immediately following a text row (no newline separator).
for (const text of ['محفظة صيفي الجديدة\nخدمات مالية', 'Welcome to SAIFI Wallet\nOur services']) {
  const valid = '0:{"body":"$1","next":"$2"}\n1:T' + Buffer.byteLength(text).toString(16) + ',' + text + '2:{"ready":true}\n';
  const broken = valid.replace(/1:T[\da-f]+,/, '1:T' + (Buffer.byteLength(text) - 4).toString(16) + ',');
  assert.throws(() => parseFlight(broken));
  const repaired = repairFlightTextLengths(broken);
  assert.equal(repaired.stream, valid);
  assert.equal(repaired.repairs.length, 1);
  assert.equal(parseFlight(valid).records.get('1'), text);
  assert.deepEqual(repairFlightTextLengths(valid), {stream: valid, repairs: []});
  const html = '<script>self.__next_f.push([0])</script><script>self.__next_f.push(' + JSON.stringify([1, broken.slice(0, 25)]) + ')</script><script>self.__next_f.push(' + JSON.stringify([1, broken.slice(25)]) + ')</script><script src="/client.js"></script>';
  const result = repairRouteFlight(html);
  assert.equal(flightPayload(result.html), valid);
  assert(result.html.includes('<script src="/client.js"></script>'));
  assert.deepEqual(repairRouteFlight(result.html), {html: result.html, repairs: []});
}

let textRows = 0, decodedRoutes = 0;
const affectedPages = ['/ar', '/en', '/ar/services', '/en/services'];
for (const route of routes) {
  const file = route.slice(1) + '/index.html';
  const source = fs.readFileSync(path.join(root, 'vendor/routes', file), 'utf8');
  const html = fs.readFileSync(path.join(dist, file), 'utf8');
  const stream = flightPayload(html), parsed = parseFlight(stream);
  let page;
  try { page = await decodeWholePage(stream, parsed); }
  catch (error) { throw new Error(route + ': React Flight decode failed', {cause: error}); }
  if (route.endsWith('/services')) {
    const builtList = page.strings.find(value => value.startsWith('[\n  {\n    "id": 1,'));
    const builtServices = JSON.parse(builtList);
    const iconById = {1:'trasfer_light.svg',69:'saifi_cash.svg',2:'recharg.svg',35:'whindraw.svg',4:'trasfer_p2p.svg',3:'pay_puch.svg',8:'saifi.svg',7:'geme.svg',6:'payment.svg'};
    assert.equal(builtServices.length, 9, route + ': preserve service count');
    for (const [index, service] of builtServices.entries()) {
      assert(iconById[service.id], route + ': preserve known service ID ' + service.id);
      assert.equal(service.mainIconUrl, '/img/' + iconById[service.id], route + ': supplied icon for service ' + service.id);
    }
  } else {
    assert.equal(stream, flightPayload(source), route + ': build must preserve component data');
  }
  assert.equal(repairRouteFlight(source).repairs.length, 0, route + ': canonical data must already be repaired');
  textRows += parsed.textRows.length;
  decodedRoutes++;
  assert.equal('/' + page.decoded.c.slice(1).join('/'), route, route + ': decoded route');
  if (affectedPages.includes(route)) {
    assert(page.elements.length > 40, route + ': decoded component tree');
    assert(page.strings.some(value => /SAIFI|صيفي/.test(value)), route + ': identity text');
    if (route.endsWith('/services')) {
      const serviceList = page.strings.find(value => value.startsWith('[\n  {\n    "id": 1,'));
      const services = JSON.parse(serviceList);
      assert.equal(services.length, 9, route + ': original nine service cards');
      assert(services.every(value => value.title && value.enTitle && value.firstImageUrl));
    } else {
      assert(page.strings.some(value => value.includes('valueCardGrid') || value.includes('Borouj') || value.includes('بروج')), route + ': complete homepage content');
    }
  }
}
const reportPath = path.join(root, 'verification-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
report.transportChecks = {passed: true, canonicalRoutes: routes.length, publishedRoutes: decodedRoutes, textRows, shippedReactDecoder: true, affectedPages, suppliedServiceIconsInReactData: true, fragmentedUtf8: true};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log('Passed: all 90 complete page models through the shipped React decoder; corrected UTF-8 byte lengths and supplied service icon data verified. UI rendering remains unverified.');
