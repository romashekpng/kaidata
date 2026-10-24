import { copyFile, mkdir } from 'node:fs/promises';
await mkdir(new URL('../src/vendor/', import.meta.url), { recursive: true });
await copyFile(new URL('../node_modules/exceljs/dist/exceljs.min.js', import.meta.url), new URL('../src/vendor/exceljs.min.js', import.meta.url));
await copyFile(new URL('../node_modules/exceljs/LICENSE', import.meta.url), new URL('../src/vendor/exceljs.LICENSE.txt', import.meta.url));
console.log('ExcelJS browser library and MIT license synchronized.');
