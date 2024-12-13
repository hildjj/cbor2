import {cjsImportsPlugin} from './tools/imports-plugin.tsup.js';
import {defineConfig} from 'tsup';

const commonSettings = {
  clean: true,
  dts: true,
  entry: ['src/*.ts'],
  minify: true,
  sourcemap: true,
  splitting: false,
  target: 'es2022',
  bundle: false,
  cjsInterop: true,
};

export default defineConfig([
  // ESM configuration
  {
    ...commonSettings,
    format: ['esm'],
    outDir: 'lib',
  },
  // CJS configuration
  {
    ...commonSettings,
    format: ['cjs'],
    outDir: 'lib/cjs',
    plugins: [cjsImportsPlugin()],
  },
]);
