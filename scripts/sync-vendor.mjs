import { copyFile, mkdir } from 'node:fs/promises';
await mkdir(new URL('../src/vendor/', import.meta.url), { recursive: true });
const files={
 'exceljs/dist/exceljs.min.js':'exceljs.min.js','exceljs/LICENSE':'exceljs.LICENSE.txt',
 'echarts/dist/echarts.min.js':'echarts.min.js','echarts/LICENSE':'echarts.LICENSE.txt','echarts/NOTICE':'echarts.NOTICE.txt',
 'chart.js/dist/chart.umd.min.js':'chart.min.js','chart.js/LICENSE.md':'chart.LICENSE.txt',
 'plotly.js-basic-dist-min/plotly-basic.min.js':'plotly.min.js','plotly.js-basic-dist-min/LICENSE':'plotly.LICENSE.txt'
};
for(const [source,target]of Object.entries(files))await copyFile(new URL('../node_modules/'+source,import.meta.url),new URL('../src/vendor/'+target,import.meta.url));
console.log('Local spreadsheet and chart libraries and licenses synchronized.');
