import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {brand} from '../src/brand.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(dist,'_rebuild/data.js'),'utf8'),scope);
const snapshot=scope.window.__SAIFI_SNAPSHOT__;
assert.equal(snapshot.routes.length,90);
for(const route of snapshot.routes){
 const html=fs.readFileSync(path.join(dist,route.slice(1),'index.html'),'utf8');
 assert(html.includes('/_rebuild/brand.css'));
 assert(html.includes('/_rebuild/brand-runtime.js'));
 assert(html.includes('content="#22366B"'));
 assert(html.includes('/assets/brand/saifi-symbol.svg'));
 for(const tag of html.matchAll(/<meta\b[^>]*(?:property="og:image"|name="twitter:image")[^>]*>/g))assert(tag[0].includes(brand.socialImage),route+': social preview');
 const canonical=fs.readFileSync(path.join(root,'vendor/routes',route.slice(1),'index.html'),'utf8');
 const structure=text=>[...text.slice(text.indexOf('<body')).matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi)].map(m=>m[1]);
 assert.deepEqual(structure(html),structure(canonical),route+': page structure');
}
const client=fs.readFileSync(path.join(dist,'_next/static/chunks/1trr2jaj0q1rf.js'),'utf8');
assert(client.includes(brand.wallet)&&client.includes(brand.walletWhite)&&client.includes(brand.companyLogo));
assert(client.includes('شركة صيفي المالية')&&client.includes('Saifi Financial Company'));
const manifest=JSON.parse(fs.readFileSync(path.join(dist,'manifest.webmanifest'),'utf8'));
assert.equal(manifest.name,'SAIFI | صيفي');assert.equal(manifest.theme_color,brand.primary);
for(const icon of manifest.icons)assert(fs.existsSync(path.join(dist,icon.src)));
for(const file of ['saifi-wallet-white.svg','saifi-wallet-navy.svg','saifi-financial-company.svg'])assert(fs.readFileSync(path.join(root,'branding',file)).equals(fs.readFileSync(path.join(dist,'assets/brand',file))));
const config=JSON.parse(fs.readFileSync(path.join(root,'site.config.json'),'utf8'));
assert(typeof config.origin === 'string' && config.origin.startsWith('https://'));
assert.equal(config.androidUrl,null);
assert.equal(config.iosUrl,'https://apps.apple.com/app/id6472856710');
assert(fs.readFileSync(path.join(dist,'_rebuild/runtime.js'),'utf8').includes('/api/content/'));
const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.name==='.git'?[]:e.isDirectory()?walk(path.join(directory,e.name)):[path.join(directory,e.name)]);
const terms=process.argv.slice(2);
let textFiles=0;
for(const file of walk(root)){
 const relative=path.relative(root,file);
 for(const term of terms)assert(!relative.toLowerCase().includes(term.toLowerCase()),'Unexpected filename: '+relative);
 if(!/\.(?:js|mjs|css|html|json|md|txt|svg|webmanifest)$/.test(file))continue;
 const text=fs.readFileSync(file,'utf8').toLowerCase();textFiles++;
 for(const term of terms)assert(!text.includes(term.toLowerCase()),'Unexpected identifier in '+relative);
}
const report={passed:true,routesChecked:snapshot.routes.length,sourceTextFilesChecked:textFiles,externalAuditTerms:terms.length,origin:config.origin,primary:brand.primary,approvedLogosPreserved:true,contentApi:'Local snapshot',pageDocumentStructurePreserved:true,pendingOfficialLinks:['Android app','social accounts'],appMediaReplacementPending:true,browserVerification:'Not performed: required browser capability unavailable.'};
fs.writeFileSync(path.join(root,'branding-report.json'),JSON.stringify(report,null,2));
console.log(`Passed SAIFI verification: 90 routes, local content API, metadata, approved logos and ${textFiles} text files.`);
