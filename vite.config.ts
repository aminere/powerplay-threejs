import { defineConfig } from 'vite'
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig({
  esbuild: {
    minifyIdentifiers: false,
    keepNames: true,
  },
  build: {
    outDir: "lib",
    lib: {
      entry: resolve(__dirname, 'src/powerplay.ts'),
      name: 'powerplay',
      fileName: 'powerplay',
    },
    sourcemap: true,
    rollupOptions: {
      external: ['three'],
      output: {
        globals: {
          three: 'THREE'
        }
      }
    }
  },
  plugins: [dts()],
});

