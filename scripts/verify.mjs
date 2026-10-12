import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routes = JSON.parse(fs.readFileSync(path.join(root, 'vendor/routes.json'), 'utf8'));
const dataCode = fs.readFileSync(path.join(root, 'dist/_rebuild/data.js'), 'utf8');
const runtimeCode = fs.readFileSync(path.join(root, 'src/runtime.js'), 'utf8');
const listeners = {};
let networkCalls = 0;
let assignedUrl;
let nativeWindowOpens = 0;
let dialogsShown = 0;
const sandbox = {
  URL, Headers, Response, Promise, console,
  location: {origin: 'https://test.local', pathname: '/ar/support', assign: value => {assignedUrl = value;}},
  document: {
    addEventListener: (event, callback) => {listeners[event] = callback;},
    body: {append() {}},
    createElement: () => ({append() {}, addEventListener() {}, showModal() {dialogsShown++;}, close() {}, remove() {}})
  },
  window: {fetch: async () => {networkCalls++; return new Response('{}');}, open: () => {nativeWindowOpens++; return 'opened';}}
};
vm.createContext(sandbox);
vm.runInContext(dataCode, sandbox);
vm.runInContext(runtimeCode, sandbox);
const api = async (endpoint, body) => {
  const response = await sandbox.window.fetch('/api/content/' + endpoint, {method: 'POST', body: JSON.stringify(body)});
  assert.equal(response.status, 200, endpoint);
  return response.json();
};
for (const locale of ['ar', 'en']) {
  for (const slug of ['', '/aboutUs', '/services', '/guide', '/support']) {
    const route = '/' + locale + slug;
    assert(routes.includes(route));
    const html = fs.readFileSync(path.join(root, 'dist', route.slice(1), 'index.html'), 'utf8');
    assert(html.includes(`lang="${locale}"`));
    assert(html.includes(`dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`));
    assert(html.includes('/_rebuild/runtime.js'));
    for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?]+)"/g)) {
      assert(fs.existsSync(path.join(root, 'dist', decodeURIComponent(match[1]))), 'Missing route dependency: ' + match[1]);
    }
  }
}
for (const route of routes) {
  const file = path.join(root, 'dist', route.slice(1), 'index.html');
  assert(fs.existsSync(file), route);
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?]+)"/g)) {
    assert(fs.existsSync(path.join(root, 'dist', decodeURIComponent(match[1]))), route + ': missing ' + match[1]);
  }
}
assert.equal((await api('Pages/GetPages', {})).filter(page => page.publishType === 1).length, 5);
for (let ID = 1; ID <= 5; ID++) assert(Array.isArray(await api('Pages/GetPageSections', {ID, publishType: 1})));
const arabicSearch = await api('Pages/Search', {Query: 'تحويل'});
assert(arabicSearch.services.mainServices.some(item => item.id === 1));
assert(arabicSearch.services.subServices.some(item => item.id === 9));
assert(arabicSearch.faQs.some(item => item.id === 4));
const englishSearch = await api('Pages/Search', {Query: 'transfer'});
assert(englishSearch.services.mainServices.some(item => item.id === 1));
const parent = await api('Pages/GetSubServiceParentId', {ID: 9});
assert.equal(parent.parentID, 1);
const nextFaqs = await api('Pages/LoadMoreFAQs', {lastorder: 4});
assert(nextFaqs.length > 0 && nextFaqs.every(item => item.order > 4));
for (const endpoint of ['/api/visitor', '/api/visitor-problem']) {
  const response = await sandbox.window.fetch(endpoint, {method: 'POST', body: '{}'});
  assert.equal(response.status, 503);
}
assert.equal(networkCalls, 0, 'Published content and unconfigured submissions must stay local.');

for (const [current, destination] of [['/ar/support', '/en/support'], ['/en/services', '/ar/services']]) {
  sandbox.location.pathname = current;
  assignedUrl = undefined;
  listeners.click({button: 0, target: {closest: () => ({href: 'https://test.local' + destination, textContent: 'Language', target: '', hasAttribute: () => false})}, preventDefault() {}, stopImmediatePropagation() {}});
  assert.equal(assignedUrl, destination);
}
for (const [current, expected, label] of [['/ar/services/1/9', '/en/services/1/9', 'Switch to English'], ['/en/guide', '/ar/guide', 'التبديل إلى العربية']]) {
  sandbox.location.pathname = current;
  sandbox.location.search = '';
  sandbox.location.hash = '';
  assignedUrl = undefined;
  listeners.click({button: 0, target: {closest: selector => selector === 'button' ? {getAttribute: () => label} : null}, preventDefault() {}, stopImmediatePropagation() {}});
  assert.equal(assignedUrl, expected, 'Language switching must retain the complete route.');
}
assert.equal(routes.length, 90);
assert.equal(sandbox.window.open('#saifi-link-pending', '_blank'), null);
assert.equal(dialogsShown, 1, 'Missing official links should show an availability dialog.');
assert.equal(nativeWindowOpens, 0, 'Missing links should not open an unverified destination.');
assert.equal(sandbox.window.open('https://example.com', '_blank'), 'opened');
assert.equal(nativeWindowOpens, 1, 'Configured external destinations should retain normal behavior.');
const report = {passed: true, routesChecked: routes.length, locales: ['ar', 'en'], apiChecks: ['page content', 'bilingual search', 'service parents', 'more FAQs', 'submission failure'], browserQA: 'Not performed: required control-browser capability unavailable in this managed environment.', screenshotComparison: 'Not performed; no pixel-perfect claim.'};
fs.writeFileSync(path.join(root, 'verification-report.json'), JSON.stringify(report, null, 2));
console.log('Passed: 90 route documents, locale direction, required JS/CSS assets, bilingual search, service links, FAQ pagination, and honest form failure. Browser screenshot comparison remains unverified.');
