import {defineConfig} from 'vite';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const rootDir=dirname(fileURLToPath(import.meta.url));
export default defineConfig({base:'/SignStudio/',publicDir:'public',worker:{format:'es'},build:{target:'es2022',sourcemap:false,cssCodeSplit:true,rollupOptions:{output:{manualChunks(id){if(id.includes('pdfjs-dist'))return'pdf-renderer';if(id.includes('pdf-lib'))return'pdf-writer';}}}},resolve:{alias:{'@':resolve(rootDir,'src')}}});
