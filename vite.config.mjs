import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({base:'/number-card-divisibility/',resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},build:{outDir:'docs',emptyOutDir:true}});
