import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset URLs: itch.io serves HTML games from a sandboxed iframe on a
  // non-root subpath, so absolute "/assets/…" URLs would 404.
  base: './',
  server: { port: 5183 },
  worker: { rollupOptions: { output: {
    entryFileNames: 'assets/js/[name]-[hash].js',
    chunkFileNames: 'assets/js/[name]-[hash].js',
  } } },
  build: {
    target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 900,
    rollupOptions: { output: {
      entryFileNames: 'assets/js/[name]-[hash].js',
      chunkFileNames: 'assets/js/[name]-[hash].js',
      assetFileNames: (asset) => {
        const name = asset.name ?? '';
        const folder = /\.css$/.test(name) ? 'css' : /\.woff2?$/.test(name) ? 'fonts' : /\.(png|webp|svg)$/.test(name) ? 'ui' : 'data';
        return `assets/${folder}/[name]-[hash][extname]`;
      },
    } },
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node', setupFiles: ['./src/test/setup.ts'] },
});
