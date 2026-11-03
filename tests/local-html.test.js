import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{gunzipSync}from'node:zlib';
import{PUBLICATION_ASSETS}from'../src/publication.js';import{buildLocalHTML,localHTMLParts}from'../src/local-html.js';import{expandSiteBlocks,validateSite}from'../src/cms-data.js';import{validateBundle}from'../src/data.js';
const assets=Object.fromEntries(await Promise.all(PUBLICATION_ASSETS.map(async name=>[name,await readFile(new URL('../'+name,import.meta.url),'utf8')]))),data=validateBundle(JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url),'utf8'))),site=expandSiteBlocks(JSON.parse(await readFile(new URL('../data/pages.json',import.meta.url),'utf8')));
const unpack=html=>JSON.parse(gunzipSync(Buffer.from(html.match(/id="kai-preview-payload" type="application\/octet-stream">([\s\S]*?)<\/script>/)[1].replace(/\s/g,''),'base64')).toString());
test('saved local HTML embeds current pages, data, styles and theme as independent initial defaults',async()=>{
 const nextSite=structuredClone(site),nextData=structuredClone(data);nextSite.pages[0].heading='Моя збережена сторінка $&';nextSite.pages[0].description='Текст </script> залишається текстом';nextSite.pages[0].blocks[0].settings.columns=4;nextData.institution.name='Мій заклад';nextData.institution.styles.presets.at(-1).values.bodySize=15;
 const html=await buildLocalHTML(assets,nextData,nextSite,{theme:'warm',startRoute:'projects',snapshotId:'saved-test'}),bundle=unpack(html),AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;assert.doesNotThrow(()=>new AsyncFunction(bundle.script));
 assert(bundle.script.includes('cms.init('+JSON.stringify(validateSite(nextSite)).replaceAll('<','\\u003c')+');'));assert(bundle.script.includes('demo=validateBundle('+JSON.stringify(validateBundle(nextData)).replaceAll('<','\\u003c')+');'));
 assert.match(bundle.script,/\nconst CMS_KEY = "kai-science.offline.pages.saved-test";/);assert.match(bundle.script,/\nconst STORE = "kai-science.offline.data.saved-test";/);assert.match(bundle.script,/let theme = "warm";/);assert(html.includes('if(!location.hash)location.hash="projects";'));assert(html.includes('data-theme="warm"'));
 for(const name of PUBLICATION_ASSETS)assert.equal(bundle.assets[name],assets[name]);assert(!html.includes('src="./src/app.js?'));assert.equal(nextSite.pages[0].heading,'Моя збережена сторінка $&');
});
test('a saved HTML can be saved again without nesting old snapshots or growing indefinitely',async()=>{
 const first=structuredClone(site);first.pages[0].heading='UNIQUE-FIRST-SNAPSHOT';const one=await buildLocalHTML(assets,data,first,{snapshotId:'first'}),second=structuredClone(first);second.pages[0].heading='UNIQUE-SECOND-SNAPSHOT';const two=await buildLocalHTML(unpack(one).assets,data,second,{snapshotId:'second'}),bundle=unpack(two);
 assert(!bundle.script.includes('UNIQUE-FIRST-SNAPSHOT'));assert(bundle.script.includes('UNIQUE-SECOND-SNAPSHOT'));assert(Buffer.byteLength(two)<3*1024*1024);assert(Math.abs(two.length-one.length)<10000);assert.match(bundle.script,/\nconst CMS_KEY = "kai-science.offline.pages.second";/);
});
test('local HTML generation rejects invalid state and missing assets before reporting a save',async()=>{
 await assert.rejects(()=>buildLocalHTML(assets,data,{...site,pages:[]}),/Відсутня/);await assert.rejects(()=>buildLocalHTML(assets,data,site,{snapshotId:'bad"<script>'}),/Некоректні/);assert.throws(()=>localHTMLParts({...assets,'src/app.js':undefined},data,site),/Відсутній файл/);
});
