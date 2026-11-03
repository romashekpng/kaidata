import { PUBLICATION_ASSETS } from '../src/publication.js';
import { buildLocalHTML } from '../src/local-html.js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root=new URL('../',import.meta.url),read=relative=>readFile(new URL(relative,root),'utf8');
const assets=Object.fromEntries(await Promise.all(PUBLICATION_ASSETS.map(async name=>[name,await read(name)])));
const html=await buildLocalHTML(assets,JSON.parse(await read('data/demo.json')),JSON.parse(await read('data/pages.json')));
const out=path.resolve(process.argv[2]||'/workspace/artifacts/index.html');
await mkdir(path.dirname(out),{recursive:true});await writeFile(out,html);console.log(`Standalone HTML with CSV/XLSX support: ${out}`);
