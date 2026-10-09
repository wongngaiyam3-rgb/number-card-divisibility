import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
export default defineConfig({base:'/number-card-divisibility/',resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},plugins:[{name:'teacher-entry',closeBundle(){mkdirSync('docs/teacher',{recursive:true});writeFileSync('docs/teacher/index.html',readFileSync('docs/index.html','utf8').replace('<title>數卡整除挑戰</title>','<title>老師比賽控制台｜數卡整除挑戰</title>'));writeFileSync('docs/.nojekyll','');}}],build:{outDir:'docs',emptyOutDir:true}});
