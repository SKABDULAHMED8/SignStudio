import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildServiceWorkerSource } from './src/platform/service-worker.js';

const rootDir = dirname(fileURLToPath(import.meta.url));
const base = '/SignStudio/';
function offlineServiceWorker() {
  return { name: 'signstudio-offline-service-worker', apply: 'build', generateBundle(_options, bundle) {
    const files = Object.keys(bundle).filter(file => !file.endsWith('.map'));
    this.emitFile({ type: 'asset', fileName: 'sw.js', source: buildServiceWorkerSource({ base, files }) });
  }};
}
export default defineConfig({ base, plugins: [offlineServiceWorker()], publicDir: 'public', worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: false, cssCodeSplit: true, rollupOptions: { output: { manualChunks(id) { if (id.includes('pdfjs-dist')) return 'pdf-renderer'; if (id.includes('pdf-lib')) return 'pdf-writer'; } } } },
  resolve: { alias: { '@': resolve(rootDir, 'src') } }
});
