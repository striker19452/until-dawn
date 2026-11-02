import { defineConfig } from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:'client',envDir:fileURLToPath(new URL('.',import.meta.url)),publicDir:false,build:{outDir:'../dist',emptyOutDir:true,chunkSizeWarningLimit:1700},server:{host:'0.0.0.0',proxy:{'/api':'http://127.0.0.1:4173'}}});
