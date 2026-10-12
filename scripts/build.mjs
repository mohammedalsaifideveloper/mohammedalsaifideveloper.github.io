import {readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, rmSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {brand} from '../src/brand.mjs';
import {repairRouteFlight, flightPayload, parseFlight} from '../src/flight-stream.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(root, 'vendor');
const dist = path.join(root, 'dist');
const routes = JSON.parse(readFileSync(path.join(vendor, 'routes.json'), 'utf8'));
const mappings = JSON.parse(readFileSync(path.join(vendor, 'asset-map.json'), 'utf8'));
const {origin} = JSON.parse(readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const readJson = file => JSON.parse(readFileSync(path.join(vendor, 'data', file), 'utf8'));

const rewrite = value => value;

rmSync(dist, {recursive: true, force: true});
mkdirSync(dist, {recursive: true});
cpSync(path.join(vendor, 'public'), dist, {recursive: true});
const walk = directory => readdirSync(directory, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
cpSync(path.join(root, 'branding'), path.join(dist, 'assets/brand'), {recursive:true});
cpSync(path.join(root, 'branding/saifi-financial-company.svg'), path.join(dist, 'assets/brand/saifi-symbol.svg'));
writeFileSync(path.join(dist, 'manifest.webmanifest'), JSON.stringify({name:'SAIFI | صيفي',short_name:'SAIFI',lang:'ar',dir:'rtl',start_url:'/ar',scope:'/',display:'standalone',background_color:'#ffffff',theme_color:brand.primary,icons:[{src:'/assets/brand/saifi-icon-192.png',sizes:'192x192',type:'image/png'},{src:'/assets/brand/saifi-icon-512.png',sizes:'512x512',type:'image/png'}]},null,2));

const manifest = JSON.parse(readFileSync(path.join(vendor, 'api-manifest.json'), 'utf8'));
const responses = {};
for (const item of manifest) responses[item.endpoint + '|' + (item.body.ID ?? 'all')] = readJson(item.file);
const faqs = responses['Pages/GetPageSections|1'].find(section => section.type === 3).contents.map(item => ({...item, type: 'FAQ'}));
const parents = {};
const mainServices = [];
const subServices = [];
for (const [key, detail] of Object.entries(responses)) {
  if (!key.startsWith('Pages/GetMainServiceDetails|')) continue;
  mainServices.push({...detail.mainService, serviceType: 'MainService'});
  for (const item of detail.subServices) {
    parents[item.id] = detail.mainService.id;
    subServices.push({...item, type: 2, serviceType: 'SubService'});
  }
}
// Repair one malformed source URL using the same service's recovered icon.
function repairIcons(value) {
  if (Array.isArray(value)) return value.map(repairIcons);
  if (!value || typeof value !== 'object') return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, val]) => [key, repairIcons(val)]));
  if (typeof result.subIconUrl === 'string' && (result.subIconUrl.match(/https?:\/\//g) || []).length > 1) result.subIconUrl = result.mainIconUrl;
  return result;
}
mkdirSync(path.join(dist, '_rebuild'), {recursive: true});
const snapshot = repairIcons({routes, responses, mainServices, subServices, faqs, parents});
writeFileSync(path.join(dist, '_rebuild', 'data.js'), 'window.__SAIFI_SNAPSHOT__=' + JSON.stringify(snapshot).replaceAll('<', '\\u003c') + ';');
cpSync(path.join(root, 'src', 'runtime.js'), path.join(dist, '_rebuild', 'runtime.js'));
cpSync(path.join(root, 'src', 'compatibility.css'), path.join(dist, '_rebuild', 'compatibility.css'));
cpSync(path.join(root, 'src', 'brand.css'), path.join(dist, '_rebuild', 'brand.css'));
cpSync(path.join(root, 'src', 'brand-runtime.js'), path.join(dist, '_rebuild', 'brand-runtime.js'));
let transportTextRows=0;
for (const route of routes) {
  const file = path.join(vendor, 'routes', route.slice(1), 'index.html');
  if (!existsSync(file)) throw new Error('Missing route ' + route);
  let html = repairRouteFlight(rewrite(readFileSync(file, 'utf8'))).html;
  transportTextRows += parseFlight(flightPayload(html)).textRows.length;
  html = html.replace(/<link\b[^>]*rel="(?:manifest|icon|shortcut icon|apple-touch-icon)"[^>]*\/?\s*>/g, '');
  html = html.replace(/<meta\b[^>]*name="theme-color"[^>]*\/?\s*>/g, '');
  html = html.replace(/<meta\b[^>]*name="twitter:(?:site|creator)"[^>]*\/?\s*>/g, '');
  html = html.replace(/(<meta\b[^>]*(?:property="og:image"|name="twitter:image")[^>]*content=")[^"]*(")/g, '$1' + origin + brand.socialImage + '$2');
  html = html.replace(/(<meta\b[^>]*property="og:image:(?:width|height)"[^>]*content=")[^"]*(")/g, (match,start,end) => start + (match.includes('width') ? '1200' : '630') + end);
  html = html.replace('<head>', '<head><script src="/_rebuild/data.js"></script><script src="/_rebuild/runtime.js"></script><link rel="stylesheet" href="/_rebuild/brand.css"><link rel="stylesheet" href="/_rebuild/compatibility.css"><link rel="icon" type="image/svg+xml" href="/assets/brand/saifi-symbol.svg"><link rel="apple-touch-icon" href="/assets/brand/saifi-icon-192.png"><link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="' + brand.primary + '">');
  html = html.replace('</head>', '<script src="/_rebuild/brand-runtime.js"></script></head>');
  const output = path.join(dist, route.slice(1), 'index.html');
  mkdirSync(path.dirname(output), {recursive: true}); writeFileSync(output, html);
}
writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url=/ar"><meta name="theme-color" content="#22366B"><link rel="icon" href="/assets/brand/saifi-symbol.svg"><title>SAIFI | صيفي</title></head><body><a href="/ar">صيفي | SAIFI</a><script>location.replace("/ar")</script></body></html>');
writeFileSync(path.join(dist, '_redirects'), routes.map(route => `${route} ${route}/index.html 200`).join('\n') + '\n');
writeFileSync(path.join(dist, '.nojekyll'), '');
writeFileSync(path.join(dist, '404.html'), '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url=/ar"><title>SAIFI | صيفي</title></head><body><script>location.replace("/ar")</script></body></html>');
writeFileSync(path.join(root, 'build-report.json'), JSON.stringify({brand: brand.name, primary: brand.primary, routes: routes.length, recoveredOriginalAssets: Object.keys(mappings).length, suppliedBrandFiles: walk(path.join(root,'branding')).length, publicApiResponses: Object.keys(responses).length, build: 'passed', transportValidation: {routes: routes.length, textRows: transportTextRows, utf8ByteLengths: 'passed'}, visualComparison: 'not performed — browser capability unavailable', pendingApprovedAppMedia: true}, null, 2));
console.log(`Built ${routes.length} routes with ${Object.keys(mappings).length} original assets and ${Object.keys(responses).length} published content responses.`);
