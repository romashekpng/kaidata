import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {PUBLICATION_ASSETS} from '../src/publication.js';
test('автономний HTML зберігає код усіх бібліотек і файлів ZIP без підстановок $&, $` та $\'',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'kai-preview-'));try{
  const target=path.join(dir,'index.html');execFileSync(process.execPath,[new URL('../scripts/build-preview.mjs',import.meta.url).pathname,target]);
  const html=await readFile(target,'utf8'),match=html.match(/globalThis\.KAI_PUBLIC_ASSETS=([^\n]+);\n/);assert(match);
  const assets=JSON.parse(match[1]);for(const name of PUBLICATION_ASSETS)assert.equal(assets[name],await readFile(new URL('../'+name,import.meta.url),'utf8'),name+' must survive HTML embedding byte for byte');
  assert(!html.includes('src="./src/app.js?'));assert(html.includes('data-theme="blue"'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
