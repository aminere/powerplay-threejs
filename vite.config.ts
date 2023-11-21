import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
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
      external: ['react', 'react-dom', 'three', 'ts-events', 'gsap'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          three: 'THREE',
          gsap: 'gsap'
        }
      }
    }
  },
  plugins: [react(), dts()],
});

