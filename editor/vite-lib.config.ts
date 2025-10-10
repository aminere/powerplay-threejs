import { defineConfig } from 'vite'
import { resolve } from 'path';
import react from '@vitejs/plugin-react'
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
      entry: resolve(__dirname, 'src/spider-editor.ts'),
      name: 'spider-editor',
      fileName: 'spider-editor',
    },
    sourcemap: true,
    rollupOptions: {
      external: ['react', 'react-dom', 'three', '@blueprintjs/core'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        }
      }
    }
  },
  plugins: [react(), dts()],
});

